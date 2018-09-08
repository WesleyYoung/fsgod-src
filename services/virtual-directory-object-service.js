(() => {
    'use strict';
    const
        fs = require('fs'),
        path = require('path'),
        exec = require('child_process').exec;

    exports.VirtualDirectoryTree = VirtualDirectoryTree;
    exports.VDT = VirtualDirectoryTree;

    function VirtualDirectoryTree($dir, $done) {

        var VDT,
            scansStarted = 0,
            scansFinished = 0;

        fs.stat($dir, (err, $stat) => {
            if (err) throw err;
            VDT = new VirtualDirectory($dir, $stat);
        });

        function FileObject($fullPath, $stat) {

            var fo = this;
            fo.type = 'file';
            fo.name = $fullPath.split(/[\\\/]/gi).reverse()[0];
            fo.fullPath = $fullPath;
            fo.content = '';
            fo.dev = $stat.dev;
            fo.size = $stat.size;
            fo.uid = $stat.uid;
            fo.mode = $stat.mode;
            fo.gid = $stat.gid;
            fo.nlink = $stat.nlink;
            fo.blksize = $stat.blksize;
            fo.blocks = $stat.blocks;
            fo.ino = $stat.ino;
            fo.atime = new Date($stat.atime);
            fo.mtime = new Date($stat.mtime);
            fo.ctime = new Date($stat.ctime);

            fo.__getContentFromSrcAsync = (done) => {
                fs.readFile(fo.fullPath, 'utf-8', (err, data) => {
                    if (err) throw err;
                    fo.__updateFOContentAsync(data);
                });
            };

            fo.__getContentFromSrc = (done) => {
                fs.readFile(fo.fullPath, 'utf8', (err, data) => {
                    if (err) done(err);
                    fo.__updateFOContent(data, () => {
                        done(null);
                    });
                });
            };

            fo.__updateFileSrc = (newContent, done) => {
                fs.writeFile(fo.fullPath, newContent, (err) => {
                    if (err) throw err;
                    fo.__updateFOContent(newContent, () => {
                        done();
                    });
                });
            };

            fo.__updateFOContent = (newContent, done) => {
                fo.content = newContent;
                done();
            };

            fo.__updateFOContentAsync = (newContent) => {
                fo.content = newContent;
            };

            (() => {
                fo.__getContentFromSrc(() => {
                    scansFinished++;
                    if (scansStarted === scansFinished) end();
                });
            })();
        }

        function VirtualDirectory($fullPath, $stat) {

            var dir = this;
            dir.type = 'directory';
            dir.fullPath = path.resolve($fullPath);
            dir.name = dir.fullPath.split(/[\\\/]/gi).reverse()[0];
            dir.content = [];
            dir.dev = $stat.dev;
            dir.size = $stat.size;
            dir.uid = $stat.uid;
            dir.mode = $stat.mode;
            dir.gid = $stat.gid;
            dir.nlink = $stat.nlink;
            dir.blksize = $stat.blksize;
            dir.blocks = $stat.blocks;
            dir.ino = $stat.ino;
            dir.atime = new Date($stat.atime);
            dir.mtime = new Date($stat.mtime);
            dir.ctime = new Date($stat.ctime);

            (() => {
                fs.readdir(dir.fullPath, (err, items) => {
                    if (err) throw err;
                    items.forEach((item, index) => {
                        scansStarted++;
                        item = path.resolve(dir.fullPath, item);
                        fs.stat(item, (err, stat) => {
                            if (stat && stat.isDirectory()) {
                                dir.content.push(new VirtualDirectory(item, stat));
                            } else {
                                dir.content.push(new FileObject(item, stat));
                            }
                        });
                    });
                    scansFinished++;
                    if (scansStarted === scansFinished) end();
                });
            })();
        }

        FileObject.prototype.exe = function($cmd, $args, $output){
            var fo = this;
            if($output == undefined){
                if($args == undefined){
                    if($cmd == undefined){ $cmd = ''; $args = []; $output = () => {}; }
                    else if (typeof $cmd == 'object') { $args = $cmd; $cmd = ''; $output = () => {}; }
                    else if (typeof $cmd == 'function') { $output = $cmd; $cmd = ''; $args = []; }
                }
                else if (typeof $args == 'function' && typeof $cmd == 'string'){ $output = $args; $args = []; }
                else if (typeof $args == 'function' && typeof $cmd == 'object'){ $output = $args; $args = $cmd; $cmd = ''; }
                else if (typeof $args == 'object' && typeof $cmd == 'string') { $output = () => {}; }
            }
            exec(($cmd ? $cmd + ' ' : $cmd) + '"' + fo.fullPath + '"' + ($args.length > 0 ? ' ' + $args.join(' ') : ''), (err, stdout, stderr) => {
                if (err) throw err;
                $output(stdout, stderr);
            });
        };

        function scrubJSON ($item) {
            if (Buffer.isBuffer($item)) $item = $item.toString('utf8');
            $item = $item.replace(/^\uFEFF/, '');
            return $item;
        }

        FileObject.prototype.json = function(){
            var fo = this;
            if (fo.name.split(".").reverse()[0] !== 'json') throw 'The .json() method is only for files with the .json file extension!';
            var data = fs.readFileSync(fo.fullPath);
            data = scrubJSON(data);
            return JSON.parse(data);
        };

        FileObject.prototype.writejson = function($newJSON, $done){
            var fo = this;
            if (fo.name.split(".").reverse()[0] !== 'json') throw 'The .writejson() method is only for files with the .json file extension!';
            $newJSON = JSON.stringify($newJSON);
            $newJSON = scrubJSON($newJSON);
            fo.__updateFileSrc($newJSON, (err) => {
                if (err) throw err;
                $done();
            });
        };

        FileObject.prototype.append = function($newContent, $done){
            var fo = this;
            fo.__updateFileSrc(fo.content + $newContent, (err) => {
                if (err) throw err;
                $done();
            });
        };

        FileObject.prototype.prepend = function($newContent, $done){
            var fo = this;
            fo.__updateFileSrc($newContent + fo.content, (err) => {
                $done();
            });
        };

        FileObject.prototype.overwrite = function($newContent, $done){
            var fo = this;
            fo.__updateFileSrc($newContent, (err) => {
                $done(err);
            });
        };
        // Alias for overwrite
        FileObject.prototype.write = FileObject.prototype.overwrite;

        VirtualDirectory.prototype.get = function($name){
            var dir = this,
                isChainedRequest = $name.split(/[\/\\]/gi).length > 1 ? true : false,
                getItem;
            if (!isChainedRequest){
                dir.content.forEach((item, index) => {
                    if(item.name == $name){
                        getItem = item;
                    }
                });
                if (getItem) return getItem;
                else throw 'Item ' + $name + ' Does Not Exist';
            } else {
                var pathUrl = $name.split(/[\/\\]/gi),
                    operator = dir.get(pathUrl[0]);
                for(var i = 1; i < pathUrl.length; i++){
                    operator = operator.get(pathUrl[i]);
                }
                getItem = operator;
                if (getItem) return getItem;
            }
        };

        VirtualDirectory.prototype.mkimg = function($name, $content, $cb){
            var dir = this,
                newPath = dir.fullPath + '/' + $name;
            if (!$cb && typeof $content == 'object') { $cb = $content; $content = ''; }
            fs.exists(newPath, (exists) => {
                if (!exists){
                    fs.writeFile(newPath, $content, {encoding: 'base64'}, (err) => {
                        if (err) $cb(err);
                        fs.stat(newPath, (err, stat) => {
                            if (err) $cb(err);
                            dir.content.push(new FileObject(newPath, stat));
                            $cb(null);
                        });
                    });
                } else {
                    $cb(null);
                }
            });
        };

        VirtualDirectory.prototype.mkfile = function($name, $content, $cb){
            var dir = this,
                newPath = dir.fullPath + '/' + $name;
            if (!$cb && typeof $content == 'object') { $cb = $content; $content = ''; }
            fs.exists(newPath, (exists) => {
                if (!exists){
                    fs.writeFile(newPath, $content, (err) => {
                        if (err) $cb(err);
                        fs.stat(newPath, (err, stat) => {
                            if (err) $cb(err);
                            dir.content.push(new FileObject(newPath, stat));
                            $cb(null);
                        });
                    });
                } else {
                    $cb(null);
                }
            });
        };

        VirtualDirectory.prototype.mkdir = function($name, $mask, $cb){
            var dir = this,
                newPath = dir.fullPath + '/' + $name;
            if (typeof $mask == 'function') {
                $cb = $mask;
                $mask = 484;
            }
            fs.mkdir(newPath, $mask, function (err) {
                var exists = false;
                if (err) if (err.code === 'EEXIST') exists = true; else $cb(err);
                if (!exists) {
                    fs.stat(newPath, (err, stat) => {
                        if (err) $cb(err);
                        dir.content.push(new VirtualDirectory(newPath, stat));
                        $cb(null);
                    });
                } else {
                    $cb(null);
                }
            });
        };

        VirtualDirectory.prototype.search = function($term, $options, $cb){
            var dir = this;
            if (!$cb) { $cb = $options; $options = {}; }
            if ($options.content === undefined) $options.content = true;
            if ($options.names === undefined) $options.names = true;
            if ($options.directories === undefined) $options.directories = true;
            if ($options.files === undefined) $options.files = true;
            var searchTerm = new RegExp($term, 'g'),
                excludes = [],
                searchesStarted = 0,
                searchesFinished = 0,
                results = [];
            if ($options.excludes) {
                for (var i = 0; i < $options.excludes.length; i++){
                    if (typeof $options.excludes[i] !== 'string') throw 'All Excludes Must Be A String!';
                    else excludes.push(new RegExp($options.excludes[i], 'gi'));
                }
            }
            initSearch();
            function initSearch(){
                find(dir.content);
                function find($searchList){
                    searchesStarted++;
                    function isValid(item){
                        var valid = true;
                        for(var i = 0; i < excludes.length; i++ ){
                            if ($options.names){
                                if (excludes[i].test(item.name)) valid = false;
                            }
                            if ($options.content && item.type === 'file'){
                                if (excludes[i].test(item.content)) valid = false;
                            }
                        }
                        return valid;
                    }
                    for (var i = 0; i < $searchList.length; i++){
                        var added = false;
                        if ($searchList[i].type == 'file'){
                            if ($options.files){
                                if ($options.content){
                                    if (searchTerm.test($searchList[i].content)) {
                                        if (isValid($searchList[i])){
                                            results.push($searchList[i]);
                                            added = true;
                                        }
                                    }
                                }
                                if (!added && $options.names){
                                    if (searchTerm.test($searchList[i].name)) {
                                        if (isValid($searchList[i])){
                                            results.push($searchList[i]);
                                            added = true;
                                        }
                                    }
                                }
                            }
                        }else if ($searchList[i].type == 'directory'){
                            find($searchList[i].content);
                            if ($options.directories){
                                if (searchTerm.test($searchList[i].name)) {
                                    if (isValid($searchList[i])){
                                        results.push($searchList[i]);
                                        added = true;
                                    }
                                }
                            }
                        }
                    }
                    searchesFinished++;
                    if (searchesFinished == searchesStarted){
                        $cb(results);
                    }
                }
            }
        };

        VirtualDirectory.prototype.listContents = function(){
            var dir = this;
            for (var i = 0; i < dir.content.length; i++){
                console.log(dir.content[i].name);
            }
        };

        function end() {
            if (scansStarted === scansFinished) $done(VDT);
        }
    }

})();
