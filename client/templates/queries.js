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
