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
