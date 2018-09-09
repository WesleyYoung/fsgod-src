(() => {
  'use strict';

  const
    fs = require('fs'),
    ssh = require('node-ssh'),
    path = require('path'),
    ping = require('net-ping'),
    uuidv4 = require('uuid/v4'),
    bos = require('./basic-operations-service');

    // Remote Operations
    exports.Remop = Remop;

    function Remop() {
      var ros = this,

        events = {
          connections: {
            change: []
          },
          pendingConnections: {
            change: []
          }
        };

      function exeEvents($ev){
        var eventList = events[$ev.split('-')[0]][$ev.split('-')[1]];
        for (var i = 0;i < eventList.length; i++){
          eventList[i]();
        }
      }

      function exeConnEvents(){
        exeEvents('connections-change');
        exeEvents('pendingConnections-change');
      }

      ros.setEvent = ($ev, $val) => {
        var eventList = events[$ev.split('-')[0]][$ev.split('-')[1]]
        if (typeof $val === 'function'){
          eventList.push($val);
        } else throw 'The second argument of setEvent takes a function only!'
      }

      ros.connections = {};
      ros.pendingConnections = {};
      ros.ping = ping.createSession();

      ros.get = ($address) => {
        if (ros.connections[$address]) return ros.connections[$address];
        else {
          var isID = false, properAddress;
          for (var i in ros.connections) {
            if ($address == ros.connections[i].address) {
              isID = true;
              properAddress = ros.connections[i].address;
            }
          }
          if (isID) return ros.connections[properAddress];
          else return { ERROR: 'No connection found @ ' + $address };
        }
      };

      ros.getConnections = () => {
        var connections = [];
        for (var i in ros.connections) {
          var con = ros.get(i);
          connections.push({
            ip: con.ip,
            os: con.os,
            kernel: con.kernel,
            connection_id: con.connection_id,
            proc: con.proc,
            ram: con.ram,
            version: con.version,
            release: con.release,
            username: con.username,
            address: con.username + '@' + con.ip,
            signal: con.signal,
            active_procs: con.active_procs,
            disks: con.disks
          });
        }
        return connections;
      };

      ros.getConnection = (conn) => {
        var con = this.get(conn);
        return {
          ip: con.ip,
          os: con.os,
          kernel: con.kernel,
          connection_id: con.connection_id,
          proc: con.proc,
          ram: con.ram,
          version: con.version,
          release: con.release,
          username: con.username,
          address: con.username + '@' + con.ip,
          signal: con.signal,
          active_procs: con.active_procs,
          disks: con.disks
        };
      };

      ros.getPending = ($address) => {
        return ros.pendingConnections[$address] || { ERROR: 'No pending connection found @ ' + $address }
      };

      ros.getPendingConnections = () => {
        var connections = [];
        for (var i in ros.pendingConnections) {
          var con = ros.getPending(i);
          connections.push({ ip: con.ip, username: con.username, address: con.address });
        }
        return connections;
      };

      ros.connect = ($auth, $done) => {
        var ip = $auth.host,
        address = $auth.username + '@' + ip;
        ros.connections[address] = new RemopObject({
          ip: ip,
          auth: $auth
        }, () => {
          exeConnEvents();
        }, $done);
        exeConnEvents();
      };

      ros.removeConnection = ($address) => {
        // ros.connections[$address].ssh.end()
        delete ros.connections[$address];
        exeConnEvents();
      };

      ros.logConnections = () => {
        console.log(ros.connections);
      };

    }

    function RemopObject($info, $onChange, $done) {
      var ro = this,
      auth = $info.auth;

      ro.ip = $info.ip;
      ro.kernel = '';
      ro.os = '';
      ro.proc = {
        name: '--',
        speed: '--',
        util: '--%',
        tempC: '--',
        tempF: '--',
        cores: '--',
        arch: ''
      };
      ro.ram = {
        total: '--',
        used: '--',
        free: '--',
        shared: '--',
        buff: '--',
        available: '--',
        util: '--%'
      };
      ro.active_procs = [];
      ro.version = '';
      ro.release = '';
      ro.username = auth.username;
      ro.address = ro.username + '@' + ro.ip;
      ro.ping = ping.createSession();
      ro.connection_id = uuidv4();
      ro.disks = [];

      ro.onDeviceHealth = () => {};

      ro.setOnDeviceHealth = ($val) => {
        ro.onDeviceHealth = $val;
      };

      ro.clearOnDeviceHealth = () => {
        ro.onDeviceHealth = () => {};
      }

      ro.signal = {
        ms: null,
        sent: null,
        received: null
      }

      ro.download = ($file, $to, $done) => {
        ro.ssh.getFile($to, $file)
          .then(() => {
            $done(null);
          }, (err) => {
            $done(err);
          });
      };

      ro.upload = ($file, $to, $done) => {
        ro.ssh.putFile($file, $to)
          .then(() => {
            $done(null);
          }, (err) => {
            $done(err);
          });
      };

      ro.uploadDir = ($to, $dir, $done) => {
        var
          failed = [],
          successful = [];
        ro.ssh.putDirectory($dir, $to, {
          recursive: true,
          concurrency: 10,
          validate: (itemPath) => {
            return path.basename(itemPath).substr(0, 1) !== '.';
           },
           tick: (localPath, remotePath, error) => {
             if (error) {
               failed.push(localPath);
               console.log(error);
             }
             else successful.push(localPath);
           }
         }).then((status) => {
           $done(status);
         })
      };

      ro.readlink_ls = ($location, $done) => {
        ro.ssh.execCommand(`ls ${$location}`).then((res) => {
          ro.ssh.execCommand(`readlink -f ${$location}`).then((pwd) => {
            $done(res.stderr || pwd.stderr || null, pwd.stdout, res.stdout.split(/[\r\n]/gi));
          });
        });
      };

      ro.ls = ($location, $done) => {
        ro.ssh.execCommand(`ls ${$location}`).then((res) => {
            $done(res.stderr || null, res.stdout.split(/[\r\n]/gi));
          });
      };

      ro.ls_a = ($location, $done) => {
        ro.ssh.execCommand(`ls -a ${$location}`).then((res) => {
            $done(res.stderr || null, res.stdout.split(/[\r\n]/gi));
          });
      };

      ro.mkfile = ($path, $cb) => {
        ro.ssh.execCommand('touch ' + $path, { cwd: '/' })
          .then(res => {
            $cb(null, res.toSting('utf8'));
          }, err => {
            $cb(err);
          });
      };

      ro.mkdir = ($path, $cb) => {
        ro.ssh.execCommand('mkdir ' + $path, { cwd: '/' })
          .then(res => {
            $cb(null, res.toSting('utf8'));
          }, err => {
            $cb(err);
          });
      };

      ro.readFile = ($path, $cb) => {
        ro.ssh.execCommand('less -XF ' + $path, { cwd: '/' })
          .then(res => {
            $cb(res.stderr || null, res.stdout.toString('utf8'));
          }, err => {
            $cb(err);
          });
      };

      ro.writeFile = ($path, $writeData, $cb) => {
        ro.ssh.execCommand('echo "' + $writeData + '" | dd of=' + $path, { cwd: '/' })
          .then(res => {
            var deniedExp = new RegExp('denied', 'gi'),
            denied = deniedExp.test(res.stderr.toLowerCase());
            $cb(denied ? res.stderr : null, res.stdout);
          }, err => {
            $cb(err)
          });
      };

      ro.grabConf2JSON = ($path, $cb) => {
        ro.readFile($path, (err, res) => {
          if (err) $cb(err)
          else {
            res = res.split(/[\r\n]/gi);
            var ret = {};
            for (var i = 0; i < res.length; i++) {
              if (res[i] !== '' && res[i][0] !== '#'){
                var splitUp = res[i].split(" "),
                  val = res[i].substr(splitUp[0].length + 1);
                ret[splitUp[0]] = val;
              }
            }
            $cb(null, ret);
          }
        });
      };

      ro.writeJSON2Conf = ($path, $writeJSON, $cb) => {
        var confArr = [];
        for (var i in $writeJSON) {
          confArr.push(i + ' ' + $writeJSON[i]);
        }
        var confString = confArr.join('\r\n');
        ro.writeFile($path, confString, (err, res) => {
          if (err) $cb(err);
          else $cb(null, res);
        });
      }

      ro.grabJSON = ($path, $cb) => {
        ro.readFile($path, (err, json) => {
          if (err) $cb(err)
          else $cb(null, bos.parseJSON(json));
        });
      };

      ro.writeJSON = ($path, $writeJSON, $cb) => {
        ro.writeFile($path, bos.stringJSON($writeJSON), (err, res) => {
          if (err) $cb(err);
          else $cb(null, res);
        })
      };

      ro.fileExists = ($path, $cb) => {
        ro.ssh.execCommand(`[ -f ${$path} ] && echo "OK" || echo "False"`).then(res => {
          $cb(res.stderr || null, res.stdout == "OK");
        });
      };

      ro.dirExists = ($path, $cb) => {
        ro.ssh.execCommand(`[ -d ${$path} ] && echo "OK" || echo "False"`).then(res => {
          $cb(res.stderr || null, res.stdout == "OK");
        });
      };

      function isItemFileOrDir($path, $cb){
        ro.ssh.execCommand(`[ -d ${$path} ] && echo "OK" || echo "False"`).then(res => {
          if (res.stderr) throw res.stderr;
          if(res.stdout == "OK"){ $cb("Dir"); }
          else {
            ro.ssh.execCommand(`[ -f ${$path} ] && echo "OK" || echo "False"`).then(res => {
              if (res.stderr){ throw res.stderr; }
              else if(res.stdout == "OK"){ $cb("File"); }
              else { $cb("Unkown"); }
            });
          }
        });
      }

      ro.getFileStat = ($path, $cb) => {
        ro.ssh.execCommand(`stat ${$path}`).then(res => {
          if (res.stderr) $cb(res.stderr, null);
          else {
            var split_up = res.stdout.split(/[\r\n]/),
            stat = {
              file: split_up[0].split(': ')[1],
              access: split_up[4].split(': ')[1],
              modify: split_up[5].split(': ')[1],
              change: split_up[6].split(': ')[1],
              birth: split_up[7].split(': ')[1]
            },
            size_split = split_up[1].split('  ');
            size_split = size_split.filter(item => {
              return item !== ' ' && item !== '';
            });
            size_split = size_split.map((item) => {
              if (item[0] == ' '){
                return item.substr(1, item.length - 1);
              } else if (/[\t]/ig.test(item.substr(0, 2))) {
                  return item.substr(1, item.length);
              }
              else return item;
            });
            stat.size = size_split[0].split(': ')[1];
            stat.blocks = size_split[1].split(': ')[1];
            stat.io_blocks = size_split[2].split(': ')[1];
            stat.type = size_split[3];
            $cb(null, stat);
          }
        });
      }

      ro.fsnav = ($path, $cb) => {
        if (typeof $path !== 'string') { $cb = $path; $path = '~'; }
        var fs_obj = { location: "", directories: [], files: [] };
          ro.readlink_ls($path, (err, pwd, contents) => {
            if (err) { $cb(err, null); }
            else {
              var counter = 0;
              fs_obj.location = pwd;
              function addItem($item){
                counter++;
                isItemFileOrDir(fs_obj.location + '/' + $item, (type) => {
                  if (type == 'Dir') {
                    fs_obj.directories.push({ name: $item });
                  }
                  else if (type == "File"){
                    ro.getFileStat(fs_obj.location + '/' + $item, (err, stat) => {
                      if (err) throw err;
                      fs_obj.files.push({
                        name: $item,
                        properties: stat
                      })
                    });
                  }
                  if (counter < contents.length) { addItem(contents[counter]); }
                  else { $cb(null, fs_obj) }
                });
              }

              if (counter < contents.length) addItem(contents[counter]);
            }
          });
      };

      ro.pm = {
        aptget: {
          update: ($opts, $cb) => {
            ro.ssh.exec('sudo apt-get update', [], {
              stdin: $opts.pass,
              onStdout(chunk) {
                if ($opts.onStdout) $opts.onStdout(null, chunk.toString('utf-8'));
              },
              onStderr(chunk) {
                if ($opts.onStderr) $opts.onStderr(null, chunk.toString('utf-8'));
              }
            }).then(() => {
              $cb(null);
            }, (err) => {
              $cb(err);
            });
          },
          upgrade: ($opts, $cb) => {
            ro.ssh.exec('sudo', ['apt-get upgrade'], {
              stdin: $opts.pass,
              onStdout(chunk) {
                if ($opts.onStdout) $opts.onStdout(null, chunk.toString('utf-8'));
              },
              onStderr(chunk) {
                if ($opts.onStderr) $opts.onStderr(null, chunk.toString('utf-8'));
              }
            }).then(() => {
              $cb(null);
            }, (err) => {
              $cb(err);
            });
          },
          install: ($opts, $install, $cb) => {
            if (typeof $install === 'object') $install = $install.join(' ');
            else if (typeof $install !== 'string') throw '$install must be a string or an array of strings of apt-get packges to install';
            ro.ssh.exec('sudo apt-get install ' + $install + ' -y', [], {
              stdin: $opts.pass,
              onStdout(chunk) {
                if ($opts.onStdout) $opts.onStdout(null, chunk.toString('utf-8'));
              },
              onStderr(chunk) {
                if ($opts.onStderr) $opts.onStderr(null, chunk.toString('utf-8'));
              }
            }).then(() => {
              $cb(null);
            }, (err) => {
              $cb(null);
            });
          },
          purge: ($opts, $purge, $cb) => {
            if (typeof $purge === 'object') $purge = $install.join(' ');
            else if (typeof $purge !== 'string') throw '$purge must be a string or an array of strings of apt-get packges to remove';
            ro.ssh.exec('sudo apt-get --purge remove ' + $purge, [], {
              stdin: $opts.pass,
              onStdout(chunk) {
                if ($opts.onStdout) $opts.onStdout(null, chunk.toString('utf-8'));
              },
              onStderr(chunk) {
                if ($opts.onStderr) $opts.onStderr(null, chunk.toString('utf-8'));"./apply-patch.sh"
              }
            }).then(() => {
              $cb(null);
            }, (err) => {
              $cb(err);
            });
          }
        },
        installed: ($pkge, $cb) => {
          ro.ssh.execCommand($pkge, {})
            .then(res => {
              var checkPatt = new RegExp('command not found', 'gi');
              if (checkPatt.test(res.stderr)){
                $cb(null, false);
              } else {
                $cb(null, true);
              }
            }, err => {
              $cb(err);
            })
        }
      };

      ro.ssh = new ssh();

      ro.ssh.connect({
        host: auth.host,
        username: auth.username,
        port: auth.port || 22,
        password: auth.pass,
        tryKeyboard: true,
          onKeyboardInteractive: (name, instructions, instructionsLang, prompts, finish) => {
            if (prompts.length > 0 && prompts[0].prompt.toLowerCase().includes('password')) {
              finish([auth.pass])
            }
          }
      }).then(() => {
        ro.ssh.execCommand('uname').then((res) => {
          ro.kernel = res.stdout
          if (ro.kernel == 'Linux'){
            ro.ssh.execCommand('cat /etc/os-release').then((res) => {
              var attrs = res.stdout.split(/[\r\n]/),
              release_js = {};
              for (var i = 0; i < attrs.length; i++) {
                release_js[attrs[i].split('=')[0]] = attrs[i].substr(attrs[i].split('=')[0].length + 1).replace(/[\"\']/gi, '');
              }
              ro.os = release_js.PRETTY_NAME;
              ro.ssh.execCommand('lscpu').then(res => {
                var attrs = res.stdout.split(/[\r\n]/),
                pre_js = {},
                lscpu_js = {};
                for (var i = 0; i < attrs.length; i++) {
                  pre_js[attrs[i].split(':')[0]] = attrs[i].substr(attrs[i].split(':')[0].length + 1);
                }
                for (var i in pre_js) {
                  var hitChar = false,
                    subIndex = 0;
                  for (var j = 0; j < pre_js[i].length; j++) {
                    if (pre_js[i][j] == ' ' && !hitChar) {
                      subIndex = j + 1;
                    } else hitChar = true;
                  }
                  lscpu_js[i] = pre_js[i].substr(subIndex);
                }
                ro.proc.name = lscpu_js['Model name'];
                ro.proc.speed = (parseFloat(lscpu_js['CPU max MHz']) / 1000).toFixed(2) + 'Ghz';
                ro.proc.cores = lscpu_js['CPU(s)'];
                ro.proc.arch = lscpu_js.Architecture;
                ro.ssh.execCommand('uname -v').then((res) => {
                  ro.version = res.stdout;
                  ro.ssh.execCommand('uname -r').then((res) => {
                    ro.release = res.stdout;
                    $onChange();
                    $done(null);
                  });
                });
              });
            });
          } else if (ro.kernel == 'Darwin'){
            ro.ssh.execCommand('system_profiler SPSoftwareDataType').then(res => {
              var brokenUp = res.stdout.split(/[\r\n]/gi),
              release_js = {};
              for (var i = 0; i < brokenUp.length; i++) {
                if (brokenUp[i] !== '' && brokenUp[i] !== '    System Software Overview:' && brokenUp !== 'Software:') {
                  var condensed = brokenUp[i].substr(6);
                  release_js[condensed.split(':')[0]] = condensed.substr(condensed.split(':')[0].length + 2);
                }
              }
              ro.os = release_js['System Version'];
              ro.ssh.execCommand('sysctl -n machdep.cpu.brand_string').then(res => {
                var splitUp = res.stdout.split(' @ ');
                ro.proc.name = splitUp[0];
                ro.proc.speed = splitUp[1];
                ro.ssh.execCommand('sysctl -n hw.ncpu').then(res => {
                  ro.proc.cores = res.stdout;
                  ro.ssh.execCommand('uname -p').then((res) => {
                    ro.proc.arch = res.stdout;
                    ro.ssh.execCommand('uname -v').then((res) => {
                      ro.version = res.stdout;
                      ro.ssh.execCommand('uname -r').then((res) => {
                        ro.release = res.stdout;
                        $onChange();
                        $done(null);
                      });
                    });
                  });
                });
              });
            });
          } else {
            $onChange();
            $done(null);
          }
        });
      });

      function getProcStatus(){
        if (ro.kernel == 'Linux') {
          ro.ssh.execCommand(
`awk -v a="$(awk '/cpu /{print $2+$4,$2+$4+$5}' /proc/stat; sleep .25)" '/cpu /{split(a,b," "); print 100*($2+$4-b[1])/($2+$4+$5-b[2])}' /proc/stat`
        ).then(res => {
            ro.proc.util = parseFloat(res.stdout).toFixed(2).toString();
            ro.ssh.execCommand('cat /sys/class/thermal/thermal_zone0/temp').then(res => {
              var celsius = parseFloat(res.stdout / 1000).toFixed(1);
              ro.proc.tempC = celsius.toString();
              ro.proc.tempF = ((celsius * (9 / 5)) + 32).toFixed(1).toString();
              ro.ssh.execCommand('df -h | grep ^/dev').then((res) => {
                var splitUp = res.stdout.split(/[\r\n]/gi),
                disks = [];
                for (var i = 0; i < splitUp.length; i++) {
                  var choppedUp = splitUp[i].split(' '),
                    tempArr = [];
                  for (var j = 0; j < choppedUp.length; j++) {
                    if (choppedUp[j] !== '' && choppedUp[j] !== '/'){
                      tempArr.push(choppedUp[j])
                    }
                  }
                  disks.push({
                    path: tempArr[0],
                    total: tempArr[1],
                    used: tempArr[2],
                    available: tempArr[3],
                    util: tempArr[4].replace('%', '')
                  });
                }
                ro.disks = disks;
                ro.ssh.execCommand('free -m').then(res => {
                  var mem_values = res.stdout.split(/[\r\n]/gi)[1].split(' ').filter($v => { return $v !== ' ' && $v !== '' }),
                  ram = {
                    total: mem_values[1],
                    used: mem_values[2],
                    free: mem_values[3],
                    shared: mem_values[4],
                    buff: mem_values[5],
                    available: mem_values[6],
                    util: Math.floor(((parseInt(mem_values[1]) - parseInt(mem_values[6])) / parseInt(mem_values[1])) * 100)
                  }
                  ro.ram = ram;
                  ro.ssh.execCommand('ps -aux').then(res => {
                    var parse_data = res.stdout.split(/[\r\n]/gi),
                    active_procs = [];
                    for (var i = 1; i < parse_data.length; i++) {
                      var get_cols = parse_data[i].split(' ').filter($v => { return $v !== '' && $v !== ' ' }),
                      proc_obj = {
                        user: get_cols[0],
                        pid: get_cols[1],
                        cpu: get_cols[2],
                        mem: get_cols[3],
                        vsz: get_cols[4],
                        rss: get_cols[5],
                        tty: get_cols[6],
                        stat: get_cols[7],
                        start: get_cols[8],
                        time: get_cols[9]
                      };
                      proc_obj.command = parse_data[i].split(proc_obj.time + ' ')[1];
                      active_procs.push(proc_obj);
                    }
                    ro.active_procs = active_procs.sort((a, b) => { return parseFloat(b.cpu) - parseFloat(a.cpu) });
                    ro.onDeviceHealth();
                  });
                });
              });
            });
          });
        } else if (ro.kernel == 'Darwin') {
          ro.ssh.execCommand('ps -A -o %cpu | awk \'{s+=$1} END {print s}\'').then(res => {
            ro.proc.util = res.stdout;
            ro.ssh.execCommand('df -h | grep ^/dev').then((res) => {
              var splitUp = res.stdout.split(/[\r\n]/gi),
              disks = [];
              for (var i = 0; i < splitUp.length; i++) {
                var choppedUp = splitUp[i].split(' '),
                  tempArr = [];
                for (var j = 0; j < choppedUp.length; j++) {
                  if (choppedUp[j] !== '' && choppedUp[j] !== '/'){
                    tempArr.push(choppedUp[j])
                  }
                }
                disks.push({
                  path: tempArr[0],
                  total: tempArr[1],
                  used: tempArr[2],
                  available: tempArr[3],
                  util: tempArr[4].replace('%', '')
                });
              }
              ro.disks = disks;
              ro.onDeviceHealth();
            });
          });
        }
      }

      function getSignalStatus(){
        ro.ping.pingHost(ro.ip, (err, target, sent, rcvd) => {
          if (err) console.log(err.toString('utf-8'));
          else {
            ro.signal = {
              ms: (rcvd - sent),
              sent: sent,
              received: rcvd
            };
            $onChange();
          }
        });
      }

      getSignalStatus();

      var updateSignalStatus = setInterval(getSignalStatus, 20000),
      getProcStatus = setInterval(getProcStatus, 500);

    }
})();
