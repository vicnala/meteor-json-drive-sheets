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
