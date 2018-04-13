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

let devID = Cfg.get('device.id');
let netStatus = null;
let cloudName = null;
let azureConnected = false;
let mqttConnected = false;

if (Cfg.get('mqtt.enable') && Cfg.get('mqtt.server').indexOf('amazon')) {
  cloudName = 'Amazon';
} else if (Cfg.get('azure.enable')) {
  cloudName = 'Azure';
  Event.addGroupHandler(Azure.EVENT_GRP, function(ev, evdata, arg) {
    if (ev === Azure.EV_CONNECT) {
      azureConnected = true;
    } else if (ev === Azure.EV_C2D) {
    } else if (ev === Azure.EV_CLOSE) {
      azureConnected = false;
    }
  }, null);
} else if (Cfg.get('azure.enable')) {
  cloudName = 'GCP';
}

MQTT.setEventHandler(function(conn, ev, edata) {
  if (ev === MQTT.EV_CONNACK) {
    mqttConnected = true;
  } else if (ev === MQTT.EV_CLOSE) {
    mqttConnected = false;
  }
}, null);

let getFont = ffi('void* get_font(int)');
let fonts = [getFont(0), getFont(1), getFont(2), getFont(3)];
function line(n) {
  let res = n * ILI9341.getMaxFontHeight();
  if (res < 0) res = res + 240;
  return res;
}
function clearLine(n) {
  ILI9341.setFgColor565(ILI9341.BLACK);
  ILI9341.fillRect(0, line(n), 319, ILI9341.getMaxFontHeight());
  ILI9341.setFgColor565(ILI9341.WHITE);
}

function printCentered(xc, y, text) {
  ILI9341.print(xc - ILI9341.getStringWidth(text) / 2, y, text);
}

GPIO.set_mode(LCD_BACKLIGHT, GPIO.MODE_OUTPUT);
GPIO.write(LCD_BACKLIGHT, 1);
ILI9341.setRotation(ILI9341.PORTRAIT_FLIP);
ILI9341.setBgColor(0, 0, 0);
ILI9341.fillScreen();
ILI9341.setFont(fonts[1]);
ILI9341.setFgColor565(ILI9341.WHITE);
printCentered(160, line(0), devID);

let greeting = '';
let formatTime = ffi('char *format_time(char *)');
let btnc = [-1, 0, 0, 0];

function printNetStatus() {
  if (!netStatus) netStatus = 'not configured';
  ILI9341.setFont(fonts[1]);
  ILI9341.setFgColor565(ILI9341.WHITE);
  ILI9341.print(5, line(1), 'WiFi: ' + netStatus + '         ');
}

function printCloudStatus() {
  ILI9341.setFont(fonts[1]);
  ILI9341.setFgColor565(ILI9341.WHITE);
  let cs;
  if (cloudName) {
    let cloudConnected = false;
    if (cloudName === 'Azure') {
      cloudConnected = azureConnected;
    } else {
      cloudConnected = mqttConnected;
    }
    cs = cloudName + ', ' + (cloudConnected ? 'connected' : 'not connected');
  } else {
    cs = 'not configured';
  }
  ILI9341.print(5, line(2), 'Cloud: ' + cs + '         ');
}

function printTime() {
  ILI9341.setFont(fonts[1]);
  ILI9341.setFgColor565(ILI9341.WHITE);
  let ts = formatTime('%H:%M:%S');
  ILI9341.print(5, line(3), 'Time: ' + (ts ? ts : 'not set') + '   ');
}

function printGreeting() {
  ILI9341.setFont(fonts[1]);
  ILI9341.setFgColor565(ILI9341.WHITE);
  if (greeting) {
    printCentered(160, line(5), greeting);
  } else {
    clearLine(5);
  }
}

function printBtnStatus() {
  ILI9341.setFont(fonts[2]);
  ILI9341.setFgColor565(ILI9341.WHITE);
  let y = line(-1);
  printCentered(65, y, JSON.stringify(btnc[1]))
  printCentered(160, y, JSON.stringify(btnc[2]))
  printCentered(255, y, JSON.stringify(btnc[3]))
}

function printStatus() {
  printNetStatus();
  printCloudStatus();
  printTime()
  printGreeting()
  printBtnStatus();
}

// Monitor network connectivity.
Event.addGroupHandler(Net.EVENT_GRP, function(ev, evdata, arg) {
  if (ev === Net.STATUS_DISCONNECTED) {
    netStatus = 'not connected';
  } else if (ev === Net.STATUS_CONNECTING) {
    netStatus = 'connecting';
  } else if (ev === Net.STATUS_GOT_IP) {
    netStatus = 'connected';
  }
  printNetStatus();
}, null);

function reportBtnPress(n) {
  btnc[n] = btnc[n] + 1;

  let btns = JSON.stringify(n);
  let msg = JSON.stringify({btn: n, cnt: btnc[n]});
  if (cloudName === 'Azure') {
    Azure.sendD2CMsg('btn=' + btns, msg);
  } else {
    MQTT.pub(devID + '/messages', msg);
  }
  printBtnStatus();
}

GPIO.set_button_handler(BTN1, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 20, function() { reportBtnPress(1) }, null);
GPIO.set_button_handler(BTN2, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 20, function() { reportBtnPress(2) }, null);
GPIO.set_button_handler(BTN3, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 20, function() { reportBtnPress(3) }, null);
RPC.addHandler('M5.SetGreeting', function(args) {
  if (args.greeting === undefined) return;
  ILI9341.setFont(fonts[1]);
  greeting = '';
  printGreeting();
  greeting = args.greeting;
  printGreeting();
});

printStatus();
Timer.set(1000 /* 1 sec */, Timer.REPEAT, printStatus, null);
