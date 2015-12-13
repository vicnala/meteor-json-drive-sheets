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
