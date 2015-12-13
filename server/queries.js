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
