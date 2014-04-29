# Proxy

## Install

```sh
npm install parallel-proxy -g
```

## Config

Proxy uses [rc](https://github.com/dominictarr/rc) for config. For example, you can put the .proxyrc config file to a top level folder:


```json
{
	"port": 2803,
	"prod": {
		"port": 80,
		"host": "localhost"
	},
	"dev": {
		"port": 81,
		"host": "localhost"
	}
}
```

It will open the proxy on 2803 port, will forward all input traffic to a production localhost:80 server and to a development server localhost:81, all output traffic will be forwarded from the production server localhost:80, and all output tfaffic from the delepment server localhost:81 will be dropped.

## Run

```sh
parallel-proxy --config conf.json
```

## Run as daemon

Use [forever](https://github.com/nodejitsu/forever) if you want, but the repo contais two script, ```start.sh``` and ```stop.sh``` which uses better solution [sdt](https://github.com/grudzinski/sdt). Before using them you must install [sdt](https://github.com/grudzinski/sdt).

```
npm install sdt
```
