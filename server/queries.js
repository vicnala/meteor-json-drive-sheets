Meteor.startup(function(){
  //console.log(googleUser.services.google.scope);

  // https://github.com/percolatestudio/meteor-google-api
  // api path:
  var drv = "drive/v2/files/";

  /*// list files
  var folder = drv + Meteor.settings.DRIVE_FOLDER_ID;
  try {
    var data = GoogleApi.get(folder + '/children', {user: googleUser});
    _.each(data.items, function (item) {
      var file = GoogleApi.get(drv + item.id, {user: googleUser});
      console.log('drive file:', file.title);
    });
  } catch (e) {
    console.log(e);
  }*/


  Queries.update({}, {$set:{
    state: 'idle'
  }});

  SyncedCron.start();

  Queries.find().observe({
    added: function (query) {
      var googleUser = Meteor.users.findOne();
      // called every server start
      // add to the collection with the sheet id
      addToDriveCollection(query);
      // add the schedule
      addToCron(query);

      //console.log('Query added', query.table);
      if (!query.sheetId) {
        // add a sheet to google drive
        body = {
          'mimeType': 'application/vnd.google-apps.spreadsheet',
          'title': query.table,
          'parents': [{'id': Meteor.settings.DRIVE_FOLDER_ID}]
        };
        try {
          var res = GoogleApi.post(drv, {
            user: googleUser,
            data: body,
          });

          Queries.update({table: query.table}, {$set:{
            sheetId: res.id,
            nextRun: SyncedCron.nextScheduledAtDate(query.table).toLocaleTimeString()
          }});

          Drive.update({table: query.table}, {$set:{
            sheetId: res.id
          }});
        } catch (e) {
          console.log(e);
        }
      }
    },
    removed: function (query) {
      var googleUser = Meteor.users.findOne();
      //console.log('Query removed', query.table);
      // trash google sheet
      try {
        GoogleApi.post(drv + query.sheetId + '/trash', {user: googleUser});
      } catch (e) {
        console.log(e);
      }
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
        updateQueryState('ERROR:PERIOD', query._id);
      }
      return p;
    },
    job: function() {
      var start = new Date();
      updateQueryState('running ...', query._id);

      HTTP.call( 'GET', query.url, {}, function( err, response ) {
        if ( err ) {
          //console.log('ERROR:GET', err);
          updateQueryState('ERROR:GET', query._id);
        } else {
          var data;
          try {
            var data = JSON.parse(response.content);
          } catch (e) {
            //console.log('ERROR:JSON:PARSE:', e);
            updateQueryState('ERROR:JSON:PARSE', query._id);
            SyncedCron.remove(query.table);
          }
          if(data) {
            if (checkJSON2DStructure(data)) {
              var drive = Drive.findOne({table: query.table});
              if (drive) {
                Drive.update(drive, {$set:{data: data}});
              } else {
                updateQueryState('ERROR:MONGO', query._id);
                SyncedCron.remove(query.table);
              }

              var end = new Date();
              var next = SyncedCron.nextScheduledAtDate(query.table)
              //var diff = Math.floor((end - start) / 1000);
              var diff = (end - start) / 1000;
              Queries.update(query._id, {$set:{
                state: 'idle',
                getTime: diff,
                lastRun: end.toLocaleTimeString(),
                nextRun: next.toLocaleTimeString()
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
