Meteor.publish("userPicture", function () {
  if (this.userId) {
    return Meteor.users.find({_id: this.userId},
        {'services.google.picture': 1});
  } else {
    this.ready();
  }
});
