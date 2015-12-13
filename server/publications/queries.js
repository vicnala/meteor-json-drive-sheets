Meteor.publish("queries", function(){
  return Queries.find();
});
