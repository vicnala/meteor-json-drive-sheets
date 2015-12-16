Meteor.startup(function(){
  // drive api must be in scope (see client/lib/config.js)
  //console.log(googleUser.services.google.scope);

  // https://github.com/percolatestudio/meteor-google-api
  // The API path:
  var drv = "drive/v2/files/";

  // set everything to idle on startup
  Queries.update({}, {$set:{
    state: 'idle'
  }});
  // start cron
  SyncedCron.start();
  // observe Queries
  Queries.find().observe({
    added: function (query) {
      //console.log('Query added', query.table);
      // called every server start
      var googleUser = Meteor.users.findOne();
      // check user
      if (!googleUser) {
        console.log('Google user error!');
        return;
      }
      // check refresh token
      if (!checkToken(googleUser)) {
        console.log('token expired, refreshing ...');
        Meteor.call('exchangeRefreshToken', googleUser._id);
      }

      // add a table to the drive collection with the query.table reference
      addToDriveCollection(query);
      // add the schedule
      addToCron(query);

      // if we do not have a Google sheet Id
      // we have to create a new sheet
      if (!query.sheetId) {
        // add a sheet to google drive
        body = {
          'mimeType': 'application/vnd.google-apps.spreadsheet',
          'title': query.table,
          'parents': [{'id': Meteor.settings.DRIVE_FOLDER_ID}]
        };
        try {
          // call google drive api
          var res = GoogleApi.post(drv, {
            user: Meteor.users.findOne(), // we can't use the above googleUser because
            data: body,                   // we can have a (new) refreshed token
          });
          // update query with the new sheetId
          Queries.update({table: query.table}, {$set:{
            sheetId: res.id,
            nextRun: SyncedCron.nextScheduledAtDate(query.table).toLocaleTimeString()
          }});
          // update drive table collection with the new sheetId
          Drive.update({table: query.table}, {$set:{
            sheetId: res.id
          }});
        } catch (e) {
          console.log(e);
        }
      }
    },
    removed: function (query) {
      //console.log('Query removed', query.table);
      var googleUser = Meteor.users.findOne();
      if (query.sheetId) {
        // check refresh token
        if (!checkToken(googleUser)) {
          console.log('token expired, refreshing ...');
          Meteor.call('exchangeRefreshToken', googleUser._id);
        }
        // trash google sheet
        try {
          // call google drive api
          GoogleApi.post(drv + query.sheetId + '/trash', {user: Meteor.users.findOne()});
        } catch (e) {
          console.log(e);
        }
      }
      // remove table from drive collection
      Drive.remove({table: query.table});
      SyncedCron.remove(query.table);
    }
  });
});


function addToDriveCollection(query) {
  var exists = Drive.findOne({table: query.table});
  if (exists) {
    return;
  }

  var drive = {};
  drive['table'] = query.table;
  drive['data'] = [];
  drive['sheetId'] = query.sheetId;
  Drive.insert(drive);
}


function addToCron(query) {
  SyncedCron.add({
    name: query.table,
    schedule: function(parser) {
      // parser is a later.parse object
      var p = parser.text(query.period);
      if (p.error == 0) {
        //console.log('ERROR:PERIOD:', query.period);
        Queries.update(query._id, {$set:{
          state: 'ERROR:SCHEDULE',
          period: 'at 5:00 am'
        }});
        p.schedules = [{ t: [ 18000 ] }];
      }
      return p;
    },
    job: function() {
      // check if we are running or uploading ...
      if (query.state === 'idle') {
        // update query state
        updateQueryState('running ...', query._id);
        // star counting time
        var start = new Date();

        HTTP.call( 'GET', query.url, {}, function( err, response ) {
          if ( err ) {
            //console.log('ERROR:GET', err);
            updateQueryState('ERROR:GET', query._id);
          } else {
            // here we GET THE DATA
            var data;
            try {
              // create an object
              var data = JSON.parse(response.content);
            } catch (e) {
              updateQueryState('ERROR:JSON:PARSE', query._id);
              SyncedCron.remove(query.table);
            }
            // check data
            if(data) {
              // check structure
              if (checkJSON2DStructure(data)) {
                // actually set the data into the drive collection document
                var drive = Drive.findOne({table: query.table});
                if (drive) {
                  Drive.update(drive, {$set:{data: data}});
                } else {
                  updateQueryState('ERROR:MONGO', query._id);
                  SyncedCron.remove(query.table);
                }

                // get nextRun data
                var next = '-';
                var nextRun = SyncedCron.nextScheduledAtDate(query.table);
                // check nextRun (may be removed)
                if (nextRun)
                  next = nextRun.toLocaleTimeString();
                // calculate GET time
                var diff = Math.abs((new Date()) - start) / 1000;
                // update query information
                Queries.update(query._id, {$set:{
                  getTime: diff,
                  lastRun: (new Date()).toLocaleTimeString(),
                  nextRun: next
                }});
              } else {
                //console.log('ERROR:JSON:PARSE:', e);
                updateQueryState('ERROR:JSON:STRUCTURE', query._id);
                SyncedCron.remove(query.table);
              }
            }
          }
        });
      }
    }
  });
}


function checkJSON2DStructure (data) {
  //var data = [{a: 1, b: 2}, {x: 5, y: 8}, ...];    // Right
  //var data = [{a: 1, b: 2}, {x: [], y: 8}, ...];   // Wrong
  var result = true;
  if (data.constructor === Array) {
    _.each(data, function (item) {
      if (item.constructor === Object) {
        _.each(item, function (v) {
          //console.log(v, typeof(v));
          if (typeof(v) === 'object')
            result = false;
        })
      } else {
        //console.log('not an object');
        result = false;
      }
    });
  } else {
    //console.log('not an array');
    result = false;
  }
  //console.log('checkJSON2DStructure:', result);
  return result;
}


function updateQueryState (state, id) {
  Queries.update(id, {$set:{
    state: state
  }});
}

function checkToken(user) {
  if (user.hasOwnProperty('services')) {
    var now = new Date();
    var diff = (now - user.services.google.expiresAt) / 1000;

    if (diff > 0) {
      return false;
    }
    return true;
  } else {
    return false;
  }
}


/*// list files
var folder = drive/v2/files/ + Meteor.settings.DRIVE_FOLDER_ID;
try {
  var data = GoogleApi.get(folder + '/children', {user: googleUser});
  _.each(data.items, function (item) {
    var file = GoogleApi.get(drv + item.id, {user: googleUser});
    console.log('drive file:', file.title);
  });
} catch (e) {
  console.log(e);
}*/
