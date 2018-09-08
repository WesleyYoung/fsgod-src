(() => {
  'use strict';

  const
    fs = require('fs'),
    path = require('path');

    exports.mkdir = mkdir;
    exports.mkfile = mkfile;
    exports.mkbase64 = mkbase64;
    exports.scrubJSON = scrubJSON;
    exports.parseJSON = parseJSON;
    exports.stringJSON = stringJSON;
    exports.grabJSON = grabJSON;
    exports.grabJSONSync = grabJSONSync;
    exports.writeJSON = writeJSON;


  function mkdir($name, $mask, $cb){
      if (typeof $mask == 'function') {
          $cb = $mask;
          $mask = 484;
      }
      fs.mkdir($name, $mask, (err) => {
          var exists = false;
          if (err) if (err.code === 'EEXIST') exists = true; else $cb(err);
          $cb(null);
      });
  }

  function mkfile($name, $content, $cb){
    if (!$cb && typeof $content == 'object') { $cb = $content; $content = ''; }
    fs.exists($name, (exists) => {
        if (!exists){
            fs.writeFile($name, $content, (err) => {
                if (err) $cb(err);
            });
        } else {
            $cb(null);
        }
    });
  }

  function mkbase64($name, $content, $cb){
      if (!$cb && typeof $content == 'object') { $cb = $content; $content = ''; }
      fs.exists($name, (exists) => {
          if (!exists){
              fs.writeFile($name, $content, { encoding: 'base64' }, (err) => {
                  if (err) $cb(err);
              });
          } else {
              $cb(null);
          }
      });
  }

  function scrubJSON($item) {
    if (Buffer.isBuffer($item)) $item = $item.toString('utf8');
    $item = $item.replace(/^\uFEFF/, '');
    return $item;
  }

  function parseJSON($item) {
    $item = scrubJSON($item);
    return JSON.parse($item);
  }

  function stringJSON($item) {
    $item = JSON.stringify($item);
    return scrubJSON($item);
  }

  function grabJSONSync($name){
      if ($name.split(".").reverse()[0] !== 'json') throw 'The grabJSONSync method is only for files with the .json file extension!';
      var data = fs.readFileSync($name);
      return parseJSON(data);
  }

  function grabJSON($name, $cb){
      if ($name.split(".").reverse()[0] !== 'json') throw 'The grabJSON method is only for files with the .json file extension!';
      fs.readFile($name, (err, data) => {
        $cb(err, parseJSON(data));
      });
  }

  function writeJSON($name, $newJSON, $cb) {
      if ($name.split(".").reverse()[0] !== 'json') throw 'The writeJSON method is only for files with the .json file extension!';
      $newJSON = stringJSON($newJSON);
      fs.writeFile($name, $newJSON, (err) => {
          $cb(err);
      });
  }

})();
