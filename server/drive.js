Meteor.startup(function () {
  var sheet;
  //http://docs.meteor.com/#/full/observe
  Drive.find().observe({
    changed: function(table) {
      var start = new Date()
      var getTime = Queries.findOne({table: table.table}).getTime;

      console.log('Drive changed', table);
      Queries.update({table: table.table}, {$set:{state: 'uploading ...'}});
      // upload
      writeAll(table);

      var end = new Date();
      var diff = (end - start) / 1000;
      Queries.update({table: table.table}, {$set:{
        state: 'idle',
        uploadTime: diff,
        totalTime: (getTime + diff).toFixed(2)
      }});
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
