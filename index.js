(() => {
    const
        fs = require('fs'),
        path = require('path'),
        vdos = require('./services/virtual-directory-object-service'),
        rados = require('./services/random-access-directory-object-service'),
        ros = require('./services/remote-operations-service'),
        bos = require('./services/basic-operations-service'),
        nos = require('./services/network-operations-service');

    // Virtual Directory Object Service
    exports.VirtualDirectoryTree = vdos.VirtualDirectoryTree;
    exports.VDT = vdos.VirtualDirectoryTree;

    // Random Access Directory Object Service
    exports.rados = rados.rados;

    // Basic Operations Service
    exports.mkdir = bos.mkdir;
    exports.mkfile = bos.mkfile;
    exports.mkbase64 = bos.mkbase64;
    exports.scrubJSON = bos.scrubJSON;
    exports.parseJSON = bos.parseJSON;
    exports.stringJSON = bos.stringJSON;
    exports.grabJSONSync = bos.grabJSONSync;
    exports.grabJSON = bos.grabJSON;
    exports.writeJSON = bos.writeJSON;

    //Remote Operations Service
    exports.Remop = ros.Remop;

    //Network Operations service
    exports.NOS = nos;
})();
