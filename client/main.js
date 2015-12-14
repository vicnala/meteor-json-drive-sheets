Meteor.subscribe("queries");
Meteor.subscribe("userPicture");

var scopes = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
]

Accounts.ui.config({'requestPermissions':{'google':scopes}});
