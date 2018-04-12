load('api_azure.js');
load('api_config.js');
load('api_events.js');
load('api_gpio.js');
load('api_ili9341_spi.js');
load('api_mqtt.js');
load('api_net.js');
load('api_rpc.js');
load('api_sys.js');
load('api_timer.js');

let BTN1 = 39, BTN2 = 38, BTN3 = 37;
let LCD_BACKLIGHT = 32;

let cloudName = null;
let cloudStatus = 'not connected';

if (Cfg.get('mqtt.enable') && Cfg.get('mqtt.server').indexOf('amazon')) {
  cloudName = 'Amazon';
} else if (Cfg.get('azure.enable')) {
  cloudName = 'Azure';
  Event.addGroupHandler(Azure.EVENT_GRP, function(ev, evdata, arg) {
    if (ev === Azure.EVENT_CONNECT) {
      cloudStatus = 'connected';
    } else if (ev === Azure.EVENT_CLOSE) {
      cloudStatus = 'not connected';
    }
  }, null);
} else if (Cfg.get('azure.enable')) {
  cloudName = 'GCP';
}

// Monitor network connectivity.
let netStatus = null;
Event.addGroupHandler(Net.EVENT_GRP, function(ev, evdata, arg) {
  if (ev === Net.STATUS_DISCONNECTED) {
    netStatus = 'not connected';
  } else if (ev === Net.STATUS_CONNECTING) {
    netStatus = 'connecting';
  } else if (ev === Net.STATUS_GOT_IP) {
    netStatus = 'connected';
  }
  print('== Net status:', netStatus);
}, null);

RPC.addHandler('M5.SetText', function(args) {
  if (!args.text) return;
  ILI9341.print(5, 54, args.text);
});

let getFont = ffi('void* get_font(int)');

GPIO.set_mode(LCD_BACKLIGHT, GPIO.MODE_OUTPUT);
GPIO.write(LCD_BACKLIGHT, 1);
ILI9341.setRotation(ILI9341.PORTRAIT_FLIP);
ILI9341.setBgColor(0, 0, 0);
ILI9341.fillScreen();
ILI9341.setFont(getFont(0));

Timer.set(1000 /* 1 sec */, Timer.REPEAT, function() {
  ILI9341.setFgColor565(ILI9341.WHITE);
  if (!netStatus) netStatus = 'not configured';
  ILI9341.print(5, 0, 'WiFi: ' + netStatus + '      ');
  let cs;
  if (cloudName) {
    cs = cloudName + ', ' + cloudStatus;
  } else {
    cs = 'not configured';
  }
  ILI9341.print(5, 18, 'Cloud: ' + cs + '       ');
}, null);
