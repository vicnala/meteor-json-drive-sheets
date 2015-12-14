Queries = new Mongo.Collection("queries");

Meteor.methods({
  insertQuery: function(query) {
    if (validURL(query.url)) {
      var exists = Queries.find({ $or:[{url: query.url}, {table: query.table}]}).fetch();
      if (exists.length > 0) {
        console.log('Already exists!', exists[0].table, '|', exists[0].url);
        return false;
      } else {
        _.extend(query, {state: 'idle', getTime: '-', uploadTime: '-', totalTime: '-', lastRun: '-', nextRun: '-', sheetId: undefined});
        Queries.insert(query);
      }
    }
  },
  removeQuery: function (id) {
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
