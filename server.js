var express = require("express");
var app = express();

app.use(express.static(__dirname + "/static"));

app.get('/', function(req, res) {
  res.sendFile("index.html", {
    'root': __dirname,
    'dotfiles': 'deny',
  });
});

var server = app.listen(5000, function() {
  var host = server.address().address;
  var port = server.address().port;

  console.log("Listening on http://%s:%s", host, port);
});
