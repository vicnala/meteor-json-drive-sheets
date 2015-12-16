# 2D JSON data to drive

Enter a REST service **URL** (2D JSON format), a **sheet name** and a **schedule** and dynamically create and update Drive Sheets with REST data.

## URL queries scheduler

meteor create json-drive
cd json-drive
rm *
touch README.md
meteor

mkdir -p server/publications private lib/collections client/templates client/stylesheets

touch client/main.html
```
<head>
  <title>JSON to Drive Spreadsheets</title>
</head>
<body>
  <h2>JSON to Drive Spreadsheets</h2>
  {{> query_form}}
  <p></p>
  {{> queries}}
</body>
```

touch client/templates/query_form.html
```
<template name="query_form">
  <form id="query">
    <div id="url">
      <input type="text" name="url" id="url" value="URL">
      <label for="url">URL</label>
    </div>
    <div id="table">
      <input type="text" name="table" id="table" value="Sheet name">
      <label for="table">Sheet name</label>

    </div>
    <div id="period">
      <input type="text" name="period" id="period" value="every 10 seconds">
      <label for="period">Schedule</label>
    </div>
    <input type="submit" value="Submit">
  </form>
</template>
```

touch client/templates/query_form.js
```
Template.query_form.events({
  "submit form": function(e){
    e.preventDefault();

    var query = {
      url: $(e.target).find('[name=url]').val(),
      table: $(e.target).find('[name=table]').val(),
      period: $(e.target).find('[name=period]').val()
    };

    Meteor.call("insertQuery", query, function(error, result){
      if(error) {
        return alert(error);
      }
    });
  }
});
```

meteor remove insecure
touch lib/collections/queries.js
```
Queries = new Mongo.Collection("queries");

Meteor.methods({
  insertQuery: function(query) {
    // check for userId
    check(Meteor.userId(), String);
    // validate URL
    if (validURL(query.url)) {
      // check if we have a query with the same name or url
      var exists = Queries.find({ $or:[{url: query.url}, {table: query.table}]}).fetch();
      if (exists.length > 0) {
        console.log('Already exists!', exists[0].table, '|', exists[0].url);
        return false;
      } else {
        // extnd the query object with useful fields
        _.extend(query, {state: 'idle', getTime: '-', uploadTime: '-', totalTime: '-', lastRun: '-', nextRun: '-', sheetId: undefined});
        // instert into collection
        Queries.insert(query);
      }
    }
  },
  removeQuery: function (id) {
    check(Meteor.userId(), String);
    Queries.remove(id);
  }
});

function validURL(url) {
  // http://stackoverflow.com/questions/5717093/check-if-a-javascript-string-is-an-url
  var pattern =/^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!10(?:\.\d{1,3}){3})(?!127(?:\.\d{1,3}){3})(?!169\.254(?:\.\d{1,3}){2})(?!192\.168(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/i;
  if(!pattern.test(url)) {
    console.log("Please enter a valid URL!");
    return false;
  } else {
    return true;
  }
}
```

touch server/publications/queries.js
```
Meteor.publish("queries", function(){
  return Queries.find();
});
```

touch client/main.js
```
Meteor.subscribe("queries");
```

touch server/publications/queries.js
```
Meteor.publish("queries", function(){
  return Queries.find();
});
```

touch client/templates/queries.html
```
<template name="queries">
  <table>
    <tr>
      <td><b>Status</b></td>
      <td><b>Schedule</b></td>
      <td><b>GET time</b></td>
      <td><b>Upload time</b></td>
      <td><b>Total</b></td>
      <td><b>Last run</b></td>
      <td><b>Next run</b></td>
      <td><b>Table</b></td>
      <td><b>URL</b></td>
      <td></td>
    </tr>
    {{#each queries}}
      {{> query}}
    {{/each}}
  </table>
</template>


<template name="query">
  <tr>
    <td>{{state}}</td>
    <td>{{period}}</td>
    <td>{{getTime}}</td>
    <td>{{uploadTime}}</td>
    <td>{{totalTime}}</td>
    <td>{{lastRun}}</td>
    <td>{{nextRun}}</td>
    <td><b><i>{{table}}</i></b></td>
    <td><span title="{{url}}"><i>URL (hover)</i></span></td>
    <td><input type="button" class="remove-button" value="Remove"></td>
  </tr>
</template>
```

touch client/templates/queries.js
```
Template.queries.helpers({
  queries: function(){
    return Queries.find();
  }
});

Template.query.events({
  "click .remove-button": function(e){
    e.preventDefault();
    Meteor.call("removeQuery", this._id, function(error, result){
      if(error){
        console.log("error", error);
      }
    });
  }
});
```

touch client/stylesheets/style.css
```
html {
  font-family: sans-serif;
}

table {
  font-size: 0.85em;
}

tr:nth-child(even) {
  background: #EEE;
}
```


meteor add percolate:synced-cron
meteor add http
touch server/queries.js
```
Meteor.startup(function(){
  Queries.update({}, {$set:{
    state: 'idle'
  }});

  SyncedCron.start();
});


Queries.find().observe({
  added: function (query) {
    // called every server start
    //console.log('Meteor: added', query);
    addToCron(query);
  },
  removed: function (query) {
    //console.log('Meteor: remove', query);
    SyncedCron.remove(query.table);
  }
});


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
            console.log(data);
            if (checkJSON2DStructure(data)) {

              // TODO something with data

              var end = new Date;
              //var diff = Math.floor((end - start) / 1000);
              var diff = (end - start) / 1000;
              Queries.update(query._id, {$set:{
                state: 'idle',
                spent: diff
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
```

Uses [Later text parser](http://bunkat.github.io/later/parsers.html#text)
Examples:
  * 'every 10 seconds starting on the 2nd second'
  * 'every 10 minutes starting on the 2nd minute'


### JSON test

**Right structure**

http://www.filltext.com/?rows=2&fname={firstName}&lname={lastName}

[{"fname":"Mayra","lname":"Grunert"},{"fname":"Laura","lname":"Molina"}]

**Wrong structure**

http://www.filltext.com/?rows=2&name={firstName}&@friends={rows=2*name={firstName}}

[{"name":"Twyonna","friends":[{"name":"Lauris"},{"name":"Maki"},{"name":"Walter"},{"name":"Jesse"}]},{"name":"Irma","friends":[{"name":"Asif"},{"name":"Steve"}]}]


## The Drive collection

touch lib/collections/drive.js
```
Drive = new Mongo.Collection("drive");
```

Add things to server/queries.js
```
Meteor.startup(function(){
  Queries.update({}, {$set:{
    state: 'idle'
  }});

  SyncedCron.start();
});


Queries.find().observe({
  added: function (query) {
    // called every server start
    //console.log('Meteor: added', query);
    addToDrive(query);
    addToCron(query);
  },
  removed: function (query) {
    //console.log('Meteor: remove', query);
    removeFromDrive(query);
    SyncedCron.remove(query.table);
  }
});


function addToDrive(query) {
  var drive = {};
  drive['table'] = query.table;
  drive['data'] = [];
  Drive.insert(drive);
}

function removeFromDrive(query) {
  Drive.remove({table: query.table});
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

              var end = new Date;
              //var diff = Math.floor((end - start) / 1000);
              var diff = (end - start) / 1000;
              Queries.update(query._id, {$set:{
                state: 'idle',
                spent: diff
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
```

## Drive side

**Using Meteor Google Accounts**

touch .gitignore
```
settings.json
private
```
(this contains private data)

Set the ID of the working folder that is in the URL of your Drive:

touch settings.json
```
{
  "GOOGLE_CLIENT_ID": "xxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com",
  "GOOGLE_SECRET": "xxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "DRIVE_FOLDER_ID": "xxxxxxxxxxxxxxxxxxxxxx",
}
```

meteor add accounts-ui
meteor add accounts-google
meteor add percolate:google-api

touch server/google-account-config.js
```
Meteor.startup(function(){
  Accounts.loginServiceConfiguration.remove({
    service: "google"
  });

  Accounts.loginServiceConfiguration.insert({
    service: "google",
    clientId: Meteor.settings.GOOGLE_CLIENT_ID,
    secret: Meteor.settings.GOOGLE_SECRET
  });
});
```

client/main.html
```
<head>
  <title>Meteor REST to Drive sheets sync</title>
</head>
<body>
    {{#if currentUser}}
      <div style="float: right">
        <img class="img-rounded"
             style="height: 32px; margin-top: 4px;"
             src="{{currentUser.services.google.picture}}"/>
          {{> loginButtons}}
      </div>
        <h2>Meteor REST to Drive sheets sync</h2>
        {{> query_form}}
        <p></p>
        {{> queries}}
    {{else}}
      <div style="float: right">
        {{> loginButtons}}
      </div>
      <h2>Meteor REST to Drive sheets sync</h2>
    {{/if}}
</body>
```

mkdir client/lib
touch client/lib/config.js
```
var scopes = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
]

Accounts.ui.config({
  'requestPermissions':{
    'google': scopes
  },
  'requestOfflineToken': {
    google: true
  }
});
```

touch server/publications/users.js
```
Meteor.publish("userPicture", function () {
  if (this.userId) {
    return Meteor.users.find({_id: this.userId},
        {'services.google.picture': 1});
  } else {
    this.ready();
  }
});
```

server/queries.js
```
Meteor.startup(function(){
  var googleUser = Meteor.users.findOne();
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
      // called every server start
      //console.log('Query added', query.table);
      if (!query.sheetId) {
        // add a sheet to google drive
        body = {
          'mimeType': 'application/vnd.google-apps.spreadsheet',
          'title': query.table,
          'parents': [{'id': Meteor.settings.DRIVE_FOLDER_ID}]
        };
        try {
          console.log('post to google');
          var res = GoogleApi.post(drv, {
            user: googleUser,
            data: body,
          });

          Queries.update({table: query.table}, {$set:{
            sheetId: res.id
          }});
        } catch (e) {
          console.log(e);
        }
      }
      // add to the collection with the sheet id
      addToDriveCollection(query);
      // add the schedule
      addToCron(query);
    },
    removed: function (query) {
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
  if (exists)
    return;

  var drive = {};
  drive['table'] = query.table;
  drive['data'] = [];
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

              var end = new Date;
              //var diff = Math.floor((end - start) / 1000);
              var diff = (end - start) / 1000;
              Queries.update(query._id, {$set:{
                state: 'idle',
                spent: diff
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
```

## Working with sheets

Go to the Google Developers Console.
Select or create a project for your Meteor app.
Create a service account if you don't already have one for this project:
    In the sidebar on the left, expand APIs & auth. Select Credentials.
    Under the OAuth heading, select Create new Client ID.
    When prompted, select Service Account and click Create Client ID.
    A dialog box appears. To proceed, click Okay, got it.
Your service account should have a private key associated. Save that private key into a file named "google-key.pem" in your app's "private" folder. You might be given the key within a JSON file, in which case you need to extract and parse it into the separate PEM file (replace "\n" with actual line breaks, etc.).
Make note of the email address created for your service account (a long, random address). You will need to add this address to ```settings.json```:

settings.json
```
{
  "GOOGLE_CLIENT_ID": "xxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com",
  "GOOGLE_SECRET": "xxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "DRIVE_FOLDER_ID": "xxxxxxxxxxxxxxxxxxxxxx",
  "SERVICE_EMAIL": xxxx@xxxxx.iam.gserviceaccount.com"
}
```

Now add the google-spreadsheets package to your Meteor app.

mkdir packages
cd packages
git clone https://github.com/ongoworks/meteor-google-spreadsheets.git

meteor add ongoworks:google-spreadsheets

*Change things to use spreadsheetId instead of spreadsheetName in packages/meteor-google-spreadsheets/server/methods.js*

touch server/drive.js
```
Meteor.startup(function () {
  //http://docs.meteor.com/#/full/observe
  Drive.find().observe({
    changed: function(table) {
      console.log('Drive changed', table.table);
      // start counting upload time
      var start = new Date()
      var query = Queries.findOne({table: table.table});
      // check query (it may be removed)
      if (query) {
        Queries.update({table: table.table}, {$set:{state: 'uploading ...'}});
        // upload
        writeAll(table);
        // ended
        var end = new Date();
        var diff = Math.abs(end - start) / 1000;
        // update query data
        Queries.update({table: table.table}, {$set:{
          state: 'idle',
          uploadTime: diff,
          totalTime: Math.abs(query.getTime + diff).toFixed(2)
        }});
      }
    },
    added: function (table) {
      // called every server start
      console.log('Drive added', table.table);
    },
    removed: function (table) {
      console.log('Drive removed', table.table);
    }
  });
});

function writeAll (table) {
  var obj = {};
  obj[1] = {}
  var colPropNames = {};
  var col = 1;

  // get column names
  _.each(table.data[0], function (val, key) {
    obj[1][col] = key;
    colPropNames[key] = col;
    col++;
  });

  // setup the sheet object to upload
  var row = 2;
  table.data.forEach(function (item) {
    obj[row] = {};
    _.each(item, function (val, prop) {
      var pCol = colPropNames[prop];
      if (!pCol)
        return;
      obj[row][pCol] = val.toString();
    });
    row++;
  });
  // call update (upload) method
  Meteor.call("spreadsheet/update",  table.sheetId, "1", obj, {email: Meteor.settings.SERVICE_EMAIL});
}
```


rewrite server/queries.js
```
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
```
