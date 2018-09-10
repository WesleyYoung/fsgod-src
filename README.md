# FSGOD


Dynamic file system operations locally or across networks

### Instantiation

```javascript
const fsgod = require('fsgod');
```

## Components

# Remote Operations (Remop)

Remop uses [node-ssh](https://www.npmjs.com/package/node-ssh "node-ssh") to facilitate connections over ssh2

NOTE: At the moment, only Linux based operating systems can be remotely operated and monitored.

NOTE: As of now, Remote-Operations does not support RSA keys.

### connect

When the connect function is called, it adds the connection into the remop.connections object where it can be accessed with other connections

```javascript
const fsgod = require('fsgod');

var remop = new fsgod.Remop();

remop.connect({
  host: '192.168.X.X',
  username: 'yourUsername',
  pass: 'yourPassword'
}, (err) => {
  if (err) throw err;
});
```

### ssh

The ssh method exposes the [node-ssh](https://www.npmjs.com/package/node-ssh "node-ssh") API and all of it's functionality can be accessed via the 'ssh' property like so:

```javascript
remop.connect({
  host: '192.168.X.X',
  username: 'yourUsername',
  pass: 'yourPassword'
}, (err) => {
  if (err) throw err;
  // remop.get retrieves the connection object using yourUsername@host
  var myConnection = remop.get('yourUsername@192.168.X.X');

  myConnection.ssh.execCommand('hh_client --json', { cwd:'/var/www' }).then(function(result) {
    console.log('STDOUT: ' + result.stdout)
    console.log('STDERR: ' + result.stderr)
  })

});
```

### setEvent

setEvent adds a task to be performed when the specified event happens, so far there is only one watcher for events 'connections-change'

the 'connections-change' is called whenever theres a change in one of the connections. (i.e. when a connection is established, removed, disconnected, or ping latency is updated)

```javascript

remop.setEvent('connections-change', () => {
  console.log('theres been a change in the connections object');
  console.log(remop.getConnections());
});
```

Adding the above code to your script will log 'theres been a change in the connections object' and your connections list anytime a change happens

## Connection API

### mkfile

mkfile is a wrapper for the 'touch' command in bash.

```javascript
var myConnection = remop.get('pi@192.168.X.X');

myConnection.mkfile('home/pi/test.txt', (err, res) => {
  if (err) throw err;
  console.log(res);
});
```

### mkdir

mkdir is a wrapper for the 'mkdir' command in bash.

```javascript
var myConnection = remop.get('pi@192.168.X.X');

myConnection.mkdir('home/pi/test', (err, res) => {
  if (err) throw err;
  console.log(res);
});
```

### readFile

readFile works the same as fs.readFile file, but it retrieves the content of a file over the ssh2 connection you call it on, rather than your local machine.

Lets say you connected to a Raspberry Pi on your network and wanted to retrieve a text file called 'test.txt' in your 'pi' directory.

```javascript
var myConnection = remop.get('pi@192.168.X.X');

myConnection.readFile('home/pi/test.txt', (err, contents) => {
  if (err) throw err;
  console.log(contents);
});
```

### writeFile

writeFile replaces the content of a file over the ssh2 connection you call it on. Unlike fs.writeFile, it will throw an error if the file does not exist

Lets say we wanted to update that file on our Raspberry Pi and then get the contents again

```javascript
var myConnection = remop.get('pi@192.168.X.X');

myConnection.writeFile('home/pi/test.txt', 'Hello World!', (err) => {
  if (err) throw err;
  myConnection.readFile('home/pi/test.txt', (err, contents) => {
    if (err) throw err;
    console.log(contents); // Hello World
  });
});
```

### grabJSON

grabJSON retireves the content of the target .json file on the target server and parses it into a JavaScript object before returning it to you.

Lets say we have a file on our Raspberry Pi with the path 'home/pi/test.json' and we need its contents.

/home/pi/test.json =
```JSON
{
  "foo": "bar"
}
```

```javascript
var myConnection = remop.get('pi@192.168.X.X');

myConnection.grabJSON('home/pi/test.json', (err, json) => {
  if (err) throw err;
  console.log(json.foo); // "bar"
});
```

### writeJSON

writeJSON overwrites the content of the target .json file on the target server.

Lets say we have a file on our Raspberry Pi with the path 'home/pi/test.json' and we want to grab its contents, update them and save them.

/home/pi/test.json =
```JSON
{
  "foo": "bar"
}
```

```javascript
var myConnection = remop.get('pi@192.168.X.X');

myConnection.grabJSON('home/pi/test.json', (err, json) => {
  if (err) throw err;
  console.log(json.foo); // "bar"
  json.foo = "updated!";
  myConnection.writeJSON('home/pi/test.json', json, (err) => {
    if (err) throw err;
  });
});
```

### grabConf2JSON

grabConf2JSON retrieves the content of a .conf file and converts it into a JavaScript object.

Lets say we have a file on our Raspberry Pi called 'test.conf' and it's contents equal:

```
myValue 127.0.0.1

myOtherValue helloWorld

myNextValue 8081
```
If we call grabConf2JSON

```javascript
var myConnection = remop.get('pi@192.168.X.X');

myConnection.grabConf2JSON('home/pi/test.conf', (err, json) => {
  if (err) throw err;
  console.log(json);
  // { myValue: '127.0.0.1', myOtherValue: 'helloWorld', myNextValue: '8081' }
});
```

### writeJSON2Conf

writeJSON2Conf takes the key/value pairs of a JavaScript object and formats it to an acceptable .conf file string and updates the target .conf files

Lets say we want to read, update, save, then read the same .conf file as above

```javascript
var myConnection = remop.get('pi@192.168.X.X'),
  path = 'home/pi/test.conf';

myConnection.grabConf2JSON(path, (err, json) => {
  if (err) throw err;
  console.log(json);
  // { myValue: '127.0.0.1', myOtherValue: 'helloWorld', myNextValue: '8081' }
  json.myValue = 'updatedMyValue!'
  json.myOtherValue = 'updateMyOtherValue!';
  json.myNextValue = 'updatedMyNextValue!';
  myConnection.writeJSON2Conf(path, json, (err) => {
    if (err) throw err;
    /*
    home/pi/test.conf

    myValue updatedMyValue!
    myOtherValue updateMyOtherValue!
    myNextValue updatedMyNextValue!
    */
  });
});
```

### fileExists / dirExists

Simple file and Directory checking function. In the callback, the second argument is a boolean representing whether or not a file/directory exists at the specified path.

```javascript
var myConnection = remop.get('pi@192.168.X.X')

myConnection.fileExists('pathToFile', (err, exists) => {
  if (err) throw err;
  console.log(exists) // True or False
});

myConnection.dirExists('pathToDirectory', (err, exists) => {
  if (err) throw err;
  console.log(exists) // True or False
});
```

# Basic Local Operations

### mkdir

mkdir creates a directory in the desired path designated in the first argument. If a directory already exists in that location, it simply moves on and calls the callback with no errors.

```javascript
fsgod.mkdir('/myNewDirectory', (err) => {
  if (err) throw err;
});
```
The above code will create a directory in the same location as the script is ran.

You can use the second argument to assign a custom mask, the default is 484

```javascript
const fsgod = require('fsgod');

fsgod.mkdir('/myNewDirectory', 664, (err) => {
  if (err) throw err;
});
```

### mkfile

mkfile will safely create a file in the desired path designated in the first argument. If a file with the same name already exists in that location, it simply moves on and calls the callback with no errors.

```javascript
fsgod.mkfile('foo.txt', (err) => {
  if (err) throw err;
});
```

You can use the second argument to specify content for the file

```javascript
fsgod.mkfile('foo.txt', 'generic hello world text', (err) => {
  if (err) throw err;
});
```

### mkbase64

mkbase64 is the mkfile function but specifies a base64 encoding

```javascript
var base64String = '...';
fsgod.mkbase64('foo.jpg', base64String, (err) => {
  if (err) throw err;
});
```

### scrubJSON

scrubJSON removes the BOM marker from a JSON string that produces errors when you're reading and writing JSON data to json files in node

```javascript
var json = 'pretend this is the json string causing you problems'
json = fsgod.scrubJSON(json);
// json now equals 'cleaned json'

```

### parseJSON

parseJSON uses the scrubJSON method to scrub it and then parses it for you. It's basically the JSON.parse method but the string gets scrubbed

```javascript
var json = 'pretend this is the json string causing you problems'
json = fsgod.parseJSON(json);
// json now equals 'cleaned json ready for use in javascript'
```

### stringJSON

stringJSON uses the JSON.stringify method and then scrubJSON to scrub it for clean storage of JSON strings

```javascript
var json = { foo: "bar" };
json = fsgod.stringJSON(json);
// json now equals '{ "foo": "bar" }'
```

### grabJSON

grabJSON retrieves json from a .json file, scrubs it and parses it into a usable JavaScript objects

```javascript
// pathTo/data.json = {"foo": "bar"}

fsgod.grabJSON('pathTo/data.json', (err, json) => {
  if (err) throw err;
  console.log(json.foo); // will log 'bar'
});
```

### grabJSONSync

grabJSONSync is the synchronous version of grabJSON

```javascript
// pathTo/data.json = {"foo": "bar"}

json = fsgod.grabJSONSync('pathTo/data.json');

console.log(json.foo); // will log 'bar'
```

### writeJSON;

writeJSON is the reverse of grabJSON. It takes a JavaScript object, turns it into a string, cleans the string and stores it in the specified file path;

```javascript
// pathTo/data.json = {"foo": "bar"}

var json = {foo: 'bar'};

fsgod.writeJSON('pathTo/data.json', json, (err) => {
  if (err) throw err;
  console.log('write success!');
});
```
# VDT

The VDT is a recursively created JavaScript object generated from a path you designate in your file system. The VDT makes it much easier to search, read, write, append, prepend, create, delete, and execute files, as well as other file system oriented tasks that would typically be repetitive and tricky to do dynamically and efficiently.

NOTE: VDT is really for manipulating small-ish size directories, larger directories will throw a stackoverflow error

```javascript
const fsgod = require('fsgod');

// fsgod.VDT and fsgod.VirtualDirectoryTree are aliases of the same function.
fsgod.VDT('./', (vdt) => {
    vdt.content.forEach((item, index) => {
        if (item.type == 'directory') {
            console.log(item.name + ' is a dir with ' + item.content.length + ' items');
        } else {
            console.log(item.name)
        }
    });
});

```

The above code looks through the specified directory's virtual content and if it finds another directory, it prints it's name and items, if it's not a directory, it will just print it's name

The **vdt** object that gets passed to the callback in **fsgod.VDT** is the Virtual Directory Tree. **fsgod.VDT** recursively walks all the way through the specified folder and builds each item into a JavaScript object and passes it back to the user in the callback.

Consider the following example file system

```
Foo
│   bar.txt
│
└───folder1
│   │   bar.json
│   │
│   └───subfolder1
│       │   bar.xml
|       |

```

Running the below script

```javascript
const fsgod = require('fsgod');

fsgod.VDT('Foo', (vdt) => {
    console.log(vdt);
});

```

Will result in

```JSON
{
    "type": "directory",
    "fullPath": "/Foo",
    "name": "Foo",
    "content": [
        {
            "type": "file",
            "name": "bar.txt",
            "fullPath": "/Foo/bar.txt",
            "content": "",
            "dev": 2066,
            "size": 0,
            "uid": 1000,
            "mode": 33279,
            "gid": 1000,
            "nlink": 1,
            "blksize": 4096,
            "blocks": 0,
            "ino": 210616,
            "atime": "2018-02-08T23:57:25.234Z",
            "mtime": "2018-02-08T23:57:25.234Z",
            "ctime": "2018-02-08T23:57:25.234Z"
        },
        {
            "type": "directory",
            "fullPath": "/Foo/folder1",
            "name": "folder1",
            "content": [
                {
                    "type": "file",
                    "name": "bar.json",
                    "fullPath": "/Foo/folder1/bar.json",
                    "content": "",
                    "dev": 2066,
                    "size": 0,
                    "uid": 1000,
                    "mode": 33279,
                    "gid": 1000,
                    "nlink": 1,
                    "blksize": 4096,
                    "blocks": 0,
                    "ino": 210369,
                    "atime": "2018-02-08T23:57:06.560Z",
                    "mtime": "2018-02-08T23:57:34.329Z",
                    "ctime": "2018-02-08T23:57:34.329Z"
                },
                {
                    "type": "directory",
                    "fullPath": "/Foo/folder1/subfolder1",
                    "name": "subfolder1",
                    "content": [
                        {
                            "type": "file",
                            "name": "bar.xml",
                            "fullPath": "/Foo/folder1/subfolder1/bar.xml",
                            "content": "",
                            "dev": 2066,
                            "size": 0,
                            "uid": 1000,
                            "mode": 33279,
                            "gid": 1000,
                            "nlink": 1,
                            "blksize": 4096,
                            "blocks": 0,
                            "ino": 210387,
                            "atime": "2018-02-08T23:52:42.880Z",
                            "mtime": "2018-02-08T23:52:42.880Z",
                            "ctime": "2018-02-08T23:52:42.880Z"
                        }
                    ],
                    "dev": 2066,
                    "size": 144,
                    "uid": 1000,
                    "mode": 16895,
                    "gid": 1000,
                    "nlink": 1,
                    "blksize": 4096,
                    "blocks": 0,
                    "ino": 210376,
                    "atime": "2018-02-08T23:57:13.989Z",
                    "mtime": "2018-02-08T23:57:13.988Z",
                    "ctime": "2018-02-08T23:57:13.988Z"
                }
            ],
            "dev": 2066,
            "size": 256,
            "uid": 1000,
            "mode": 16895,
            "gid": 1000,
            "nlink": 1,
            "blksize": 4096,
            "blocks": 0,
            "ino": 210360,
            "atime": "2018-02-08T23:57:06.518Z",
            "mtime": "2018-02-08T23:57:06.517Z",
            "ctime": "2018-02-08T23:57:06.517Z"
        }
    ],
    "dev": 2066,
    "size": 240,
    "uid": 1000,
    "mode": 16895,
    "gid": 1000,
    "nlink": 1,
    "blksize": 4096,
    "blocks": 0,
    "ino": 210352,
    "atime": "2018-02-08T23:57:25.235Z",
    "mtime": "2018-02-08T23:57:25.234Z",
    "ctime": "2018-02-08T23:57:25.234Z"
}
```

## VDT Directory Methods

### search

Every directory object has a **search** method. The **search** method uses regular expressions to locate any item containing the string passed in the first argument. The **search** method only searches in and under the directory your are performing the search on

 ```javascript
fsgod.VDT('./', (vdt) => {
    vdt.search('test', { content: false }, (results) => {
        console.log('Found ' + results.length + ' items');
        results.forEach((item, index) => {
            console.log(item.fullPath);
        });
    });
});

 ```
The above code should find file and directory names that contain the phrase **test** and print their full paths.

You should notice the second argument takes an object which specifies search options; in the case of the above example, we don't want to look through file content for our search string, just names. The code below illustrates a **search** method without filters

```javascript
fsgod.VDT('./', (vdt) => {
    vdt.search('test', (results) => {
        console.log('Found ' + results.length + ' items');
        results.forEach((item, index) => {
            console.log(item.fullPath);
        });
    });
});
```


The filter options you can give to the object are

| Filter | Type | Usage |
|:---:|:---:|:---:|
| content | Boolean | Decides whether or not to search file content for results |
| names | Boolean | Decides whether or not to search file/directory names for results |
| files | Boolean | Decides whether or not to include files in search results |
| directories | Boolean | Decides whether or not to include directories in results |
| excludes | Array | Any search results containing a string in the 'excludes' array will be removed |

### get

Because dynamically getting objects at variable depths can be very tricky, you can use the **get** method to easily navigate the VDT. For example, if you had a directory named **Foo** and a file named **bar.txt** inside it, you could use the following code to retrieve **bar.txt**  

```javascript
fsgod.VDT('Foo', (vdt) => {
    var bar = vdt.get('bar.txt');
});

```

#### Chaining get

The **get** method can be chained either in the url passed into the first argument, or together in sequence. Lets say directory **Foo** has 3 directories underneath it, all named **Foo** and **bar.txt** is at the bottom of this tree. i.e. the local path to **bar.txt** is **Foo/Foo/Foo/Foo/bar.txt**. You could **get** it in two ways

```javascript

// The static way
fsgod.VDT('Foo', (vdt) => {
    var bar = vdt.get('Foo').get('Foo').get('Foo').get('bar.txt');
});

// The dynamic way
fsgod.VDT('Foo', (vdt) => {
    var bar = vdt.get('Foo/Foo/Foo/bar.txt');
});

```

### mkdir

The **mkdir** method will create a directory for the vdt object and in the appropriate place in your file system. Lets say we wanted to create a directory named **Foo**, and then create a directory inside **Foo** named **Bar**. This operation can be made easy using the **get** method along side **mkdir**

```javascript
fsgod.VDT('./', (vdt) => {
    vdt.mkdir('Foo', (err) => {
        if (err) throw err;
        vdt.get('Foo').mkdir('Bar', (err) => {
            if (err) throw err;
            // Foo/Bar now exists!
        });
    });
});

```

### mkfile

The **mkfile** method will create a file for the vdt object and in the appropriate place in your file system. Lets say we wanted to create a directory named **Foo**, and then create a text file inside **Foo** named **bar.txt**

```javascript
fsgod.VDT('./', (vdt) => {
    vdt.mkdir('Foo', (err) => {
        if (err) throw err;
        vdt.get('Foo').mkfile('bar.txt', (err) => {
            if (err) throw err;
            // Foo/bar.txt now exists!
        });
    });
});

```

You can also give the file content when you create it like so
```javascript
fsgod.VDT('Foo', (vdt) => {
    vdt.mkfile('bar.txt', 'Hello World', (err) => {
        // vdt.get(bar.txt).content = Hello World
    });
});

```

## VDT File Methods

### exe

The **exe** method executes the file

Let's say our directory 'Foo' contains a python file named 'bar.py' which simply logs whatever arguments we pass to it back to the console and we'd like to execute it

```javascript
fsgod.VDT('Foo', (vdt) => {
    vdt.get('bar.py').exe('python', ['arg1', 'arg2'], (stdout, stderr) => {
        console.log(stdout); // arg1 arg2
    });
});

```

The first argument passed **exe** is the intital command sent to the command line. Since we want to execute a python file, we pass 'python' to the first argument to call the python interpreter. Similarly, we could pass 'node' and execute a JavaScript file. You can also not pass a string and pass the args into the first argument if it's a file type that can be automatically run by the operating system (.exe on windows etc.)

Example

```javascript
fsgod.VDT('Foo', (vdt) => {
    vdt.get('start.exe').exe(['arg1', 'arg2'], (stdout, stderr) => {
        console.log(stdout);
    });
});

```

You can also call the method with only a call back and interpreter

```javascript
fsgod.VDT('Foo', (vdt) => {
    vdt.get('bar.py').exe('python3', (stdout, stderr) => {
        console.log(stdout);
    });
});

```

You can also call the method with only a call back

```javascript
fsgod.VDT('Foo', (vdt) => {
    vdt.get('start.exe').exe((stdout, stderr) => {
        console.log(stdout);
    });
});

```

Or execute the file with no arguments

```javascript
fsgod.VDT('Foo', (vdt) => {
    vdt.get('start.exe').exe();
});

```

### write

The **write** method overwrites the content of the source file and VDT file object

Note: **write** and **overwrite** reference the same function

```javascript
fsgod.VDT('Foo', (vdt) => {
    var bar = vdt.get('bar.txt');
    // bar.content = 'Hello World'
    bar.write('Goodbye world', (err) => {
        if (err) throw err;
        // bar.content = 'Goodbye World'
    });
});

```

### append

The **append** method adds content to the end of the source file content and VDT file object

```javascript
fsgod.VDT('Foo', (vdt) => {
    var bar = vdt.get('bar.txt');
    // bar.content = 'Hello '
    bar.append('World', (err) => {
        if (err) throw err;
        // bar.content = 'Hello World'
    });
});

```

### prepend

The **prepend** method adds content to the begining of the source file content and VDT file object

```javascript
fsgod.VDT('Foo', (vdt) => {
    var bar = vdt.get('bar.txt');
    // bar.content = 'World'
    bar.prepend('Hello ', (err) => {
        if (err) throw err;
        // bar.content = 'Hello World'
    });
});

```

### json

The **json** method only applies to files with the **.json** extension. The **json** method gets the content of the target .json file and returns it as a JavaScript object. The following code will create a file named **test.json** and then return it's content into a JavaScript object

```javascript
fsgod.VDT('./', (vdt) => {
    vdt.mkfile('test.json', '{"foo":"bar"}', (err) => {
        if (err) throw err;
        var file = vdt.get('test.json');
        console.log(file.json().foo); // will log 'bar'
    });
});

```

### writejson

The **writejson** method only applies to files with the **.json** extension. The **writejson** takes a JavaScript object and converts it to a json string and saves it as the content of the target .json file. The following code will create a file named **test.json**, then return it's content into a JavaScript object, then update the **foo** variable and save it to **test.json**

```javascript
fsgod.VDT('./', (vdt) => {
    vdt.mkfile('test.json', '{"foo":"bar"}', (err) => {
        if (err) throw err;
        var file = vdt.get('test.json'),
            json = file.json();
        console.log(json.foo); // will log 'bar'
        json.foo = "updated!";
        file.writejson(json, () => {
            console.log(file.json().foo); // wil log 'updated!'
        });
    });
});

```

## Virtual Directory

Each directory in the vdt callback is it's own Virtual Directory Tree with the same methods as the intial target directory

| Key | Type | Usage |
|:---:|:---:|:---:|
| content | Array | An array of both directories (VDT's) and files |
| name | String | The name of the file or directory |
| type | String | Will let you know if its a directory or file |
| fullPath | String | The full path to the item |
| size | Integer | Size of the item in bytes |
| search | Function | Search in and under the directory for a search string |
| get | Function | Gets the specified object and makes it's methods easily available |
| mkdir | Function | Creates a directory in the VDT and your file system |
| mkfile | Function | Creates a file in the VDT and your file system |

## Virtual File

| Key | Type | Usage |
|:---:|:---:|:---:|
| content | String | File contents |
| name | String | File name |
| type | String | Will let you know if it's a directory or file |
| fullPath | String | The full path to the item |
| size | Integer | Size of the item in bytes |
| exe | Function | Executes the file from the command line |
| write/overwrite | Function | Overwrites the content of the file |
| append | Function | Adds new content to the end of the file |
| prepend | Function | Adds new content to the beginning of the file |
| json | Function | Returns file contents as a JavaScript Object |
| writejson | Function | Writes JavaScript object as JSON string to .json file |
