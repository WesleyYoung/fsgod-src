(() => {
  'use strict';

  const
    fs = require('fs'),
    path = require('path'),
    raw = require('raw-socket'),
    ip = require('ip'),
    os = require('os'),
    pcap = require('pcap2'),
    bos = require('./basic-operations-service'),
    MAC_VENDOR_DB = path.resolve('./services/__data/macs.json');

  exports.scan_localnet = scan_localnet;

  function scan_localnet($opts, $done) {

    if (typeof $opts == 'function'){
      $done = $opts;
      $opts = {
        onResponse: ($x) => {},
        wait: 3000,
        rangeStart: 1,
        rangeEnd: 255
      }
    } else {
      if ($opts.onResponse == undefined) $opts.onResponse = ($x) => {};
      if ($opts.wait == undefined) $opts.wait = 3000;
      if ($opts.rangeStart == undefined) $opts.rangeStart = 1;
      if ($opts.rangeEnd == undefined) $opts.rangeEnd = 255;
    }

    if ($opts.rangeStart >= $opts.rangeEnd) throw `rangeStart must be less than rangeEnd!`;
    if ($opts.rangeStart < 0 || $opts.rangeStart > 254) throw `rangeStart must be between 0 and 254`;
    if ($opts.rangeEnd < 1 || $opts.rangeEnd > 255) throw `rangeEnd must be between 1 and 255`;

  	var
      sl = this,
  		my_subnet = ip.address().split('.').splice(0, 3).join('.'),
  		local_net_addrs = [],
  		iface = null,
  		iface_name = '',
  		ifaces = os.networkInterfaces(),
      responses = [];

  	for (var face in ifaces) {
  		for (var i = 0; i < ifaces[face].length; i++) {
  			if (ifaces[face][i].family == "IPv4"){
  				if (!ifaces[face][i].internal){
  					iface = ifaces[face][i];
  					break;
  				}
  			}
  		}
  		if (iface !== null) {
  			iface_name = face;
  			break;
  		}
  	}
  	if (iface == null) throw "No interface available";

  	var session = new pcap.Session(iface_name, { filter: "arp" });

  	for (var i = $opts.rangeStart; i < $opts.rangeEnd; i++) {
  		local_net_addrs.push(my_subnet + '.' + i);
  	}

  	build_packets(local_net_addrs, iface, (packets) => {

  		bos.grabJSON(MAC_VENDOR_DB, (err, macs) => {
        if (err) throw err;

  			for (var i = 0; i < packets.length; i++) {
  				session.inject(packets[i]);
  			}

  			session.on("packet", (raw) => {

  				var
            response = pcap.decode.packet(raw),
            response_data = {
              mac: response.payload.payload.sender_ha.toString(),
    					vendor: macs[response.payload.payload.sender_ha.toString().replace(/[\:]/gi, '').substr(0, 6).toUpperCase() || 'Unkown Vendor'],
    					ip: response.payload.payload.sender_pa.toString()
            }
  				$opts.onResponse(response_data);
          responses.push(response_data);
  			});

  			setTimeout(() => {
  				session.close();
          $done(responses);
  			}, $opts.wait);
  		});
  	});
  }

  function build_packets(addrs, $iface, $done){

  	var packets = [];
  	for (var i = 0; i < addrs.length; i++) {
  		packets.push(arp_request_packet(addrs[i], $iface));
  	}
  	$done(packets);
  };

  var arp_request_packet = ($to_ip, $iface) => {

  	var buffer = Buffer.alloc(42);
  	for (var i = 0; i < 6; i++) { buffer[i] = 0xFF }
  	buffer.writeUIntBE(mac_to_bytes($iface.mac), 6, 6);
  	buffer.writeUInt16BE(0x0806, 12);
  	buffer.writeUInt16BE(0x0001, 14);
  	buffer.writeUInt16BE(0x0800, 16);
  	buffer.writeUInt8(6, 18);
  	buffer.writeUInt8(4, 19);
  	buffer.writeUInt16BE(0x0001, 20);
  	buffer.writeUIntBE(mac_to_bytes($iface.mac), 22, 6);
  	buffer.writeUIntBE(ip_to_bytes($iface.address), 28, 4);
  	buffer.writeUIntBE(ip_to_bytes($to_ip), 38, 4);

  	return buffer;
  };

  var mac_to_bytes = ($mac) => {
  	var
  		mac_split = $mac.split(':'),
  		buffer = Buffer.alloc(mac_split.length);
  	for (var i = 0; i < mac_split.length; i++) {
  		buffer[i] = parseInt(mac_split[i], 16);
  	}
  	return buffer.readUIntBE(0, buffer.length);
  }

  var ip_to_bytes = ($ip) => {
  	var
  		ip_split = $ip.split('.'),
  		buffer = Buffer.alloc(ip_split.length);
  	for (var i = 0; i < ip_split.length; i++) {
  		buffer[i] = parseInt(ip_split[i], 10);
  	}
  	return buffer.readUIntBE(0, buffer.length);
  }

})();
