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
      <td><b>Time spent</b></td>
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
    <td>{{spent}}</td>
    <td>{{table}}</td>
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

**Install the client library**

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
  "SERVICE_EMAIL": xxxx@xxxxx.iam.gserviceaccount.com"
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

client/main.js
```
Meteor.subscribe("queries");
Meteor.subscribe("userPicture");

var scopes = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
]

Accounts.ui.config({'requestPermissions':{'google':scopes}});
```

lib/collections/queries.js
```
//...
        _.extend(query, {state: 'idle', spent: '-', lastrun: '-', sheetId: undefined});
//...
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
Make note of the email address created for your service account (a long, random address). You will need this address in later steps.

Now add the google-spreadsheets package to your Meteor app.

mkdir packages
cd packages
git clone https://github.com/ongoworks/meteor-google-spreadsheets.git

meteor add ongoworks:google-spreadsheets

*Change things to use spreadsheetId instead of spreadsheetName in packages/meteor-google-spreadsheets/server/methods.js*

touch server/drive.js
```
Meteor.startup(function () {
  var sheet;
  //http://docs.meteor.com/#/full/observe
  Drive.find().observe({
    changed: function(table) {
      console.log('Drive changed', table);
      writeAll(table);
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

  _.each(table.data[0], function (val, key) {
    obj[1][col] = key;
    colPropNames[key] = col;
    col++;
  });

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

  Meteor.call("spreadsheet/update",  table.sheetId, "1", obj, {email: Meteor.settings.SERVICE_EMAIL});
}
```

rewrite server/queries.js
```
Meteor.startup(function(){
  var drv = "drive/v2/files/";

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
            sheetId: res.id
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
