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
