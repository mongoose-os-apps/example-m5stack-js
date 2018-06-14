load('api_azure.js');
load('api_config.js');
load('api_events.js');
load('api_gpio.js');
load('api_ili9341_spi.js');
load('api_mqtt.js');
load('api_net.js');
load('api_rpc.js');
load('api_shadow.js');
load('api_sys.js');
load('api_timer.js');
load('api_watson.js');

let BTN1 = 39, BTN2 = 38, BTN3 = 37;
let LCD_BACKLIGHT = 32;

let devID = Cfg.get('device.id');
let greeting = '';
let btnc = [-1, 0, 0, 0];
let netStatus = null;
let cloudName = null;
let cloudConnected = false;

if (Cfg.get('azure.enable')) {
  cloudName = 'Azure';
  Event.addGroupHandler(Azure.EVENT_GRP, function(ev, evdata, arg) {
    if (ev === Azure.EV_CONNECT) {
      cloudConnected = true;
    } else if (ev === Azure.EV_C2D) {
      let c2d = Azure.getC2DArg(evdata);
      print('C2D message:', c2d.props, c2d.body);
      greeting = '';
      printGreeting();
      greeting = c2d.body;
      printGreeting();
    } else if (ev === Azure.EV_CLOSE) {
      cloudConnected = false;
    }
  }, null);
} else if (Cfg.get('gcp.enable')) {
  cloudName = 'GCP';
} else if (Cfg.get('watson.enable')) {
  cloudName = 'Watson';
  Event.addGroupHandler(Watson.EVENT_GRP, function(ev, evdata, arg) {
    if (ev === Watson.EV_CONNECT) {
      cloudConnected = true;
      watsonReportBtnStatus();
    } else if (ev === Watson.EV_CLOSE) {
      cloudConnected = false;
    }
  }, null);
} else if (Cfg.get('dash.enable')) {
  cloudName = 'Mongoose';
} else if (Cfg.get('mqtt.enable')) {
  if (Cfg.get('mqtt.server').indexOf('amazonaws') > 0) {
    cloudName = 'Amazon';
  } else {
    cloudName = 'MQTT';
  }
}

MQTT.setEventHandler(function(conn, ev, edata) {
  if (cloudName && cloudName !== 'Azure' && cloudName !== 'Watson') {
    if (ev === MQTT.EV_CONNACK) {
      cloudConnected = true;
    } else if (ev === MQTT.EV_CLOSE) {
      cloudConnected = false;
    }
  }
}, null);

let getFont = ffi('void* get_font(int)');
let fonts = [getFont(0), getFont(1), getFont(2), getFont(3)];
function clearLine(n) {
  ILI9341.setFgColor565(ILI9341.BLACK);
  ILI9341.fillRect(0, ILI9341.line(n), ILI9341.getScreenWidth(), ILI9341.getMaxFontHeight());
  ILI9341.setFgColor565(ILI9341.WHITE);
}

function printCentered(xc, y, text) {
  ILI9341.print(xc - ILI9341.getStringWidth(text) / 2, y, text);
}

// Display orientation settings.
// See https://github.com/mongoose-os-libs/ili9341-spi#orientations for details.
let M5STACK_LANDSCAPE = 0x0;        // Buttons at the bottom, 320x240
let M5STACK_PORTRAIT = 0xa0;        // Buttons on the left, 240x320
let M5STACK_LANDSCAPE_FLIP = 0xd0;  // Buttons at the top, 320x240
let M5STACK_PORTRAIT_FLIP = 0x60;   // Buttons on the right, 240x320

GPIO.set_mode(LCD_BACKLIGHT, GPIO.MODE_OUTPUT);
GPIO.write(LCD_BACKLIGHT, 1);
ILI9341.setOrientation(M5STACK_LANDSCAPE, 320, 240);
ILI9341.setBgColor(0, 0, 0);
ILI9341.fillScreen();
ILI9341.setFont(fonts[1]);
ILI9341.setFgColor565(ILI9341.WHITE);
printCentered(ILI9341.getScreenWidth() / 2, ILI9341.line(0), devID);

let formatTime = ffi('char *format_time(char *)');

function printNetStatus() {
  if (!netStatus) netStatus = 'not configured';
  ILI9341.setFont(fonts[1]);
  ILI9341.setFgColor565(ILI9341.WHITE);
  ILI9341.print(5, ILI9341.line(1), 'WiFi: ' + netStatus + '         ');
}

function printCloudStatus() {
  ILI9341.setFont(fonts[1]);
  ILI9341.setFgColor565(ILI9341.WHITE);
  let cs;
  if (cloudName) {
    cs = cloudName + ', ' + (cloudConnected ? 'connected' : 'not connected');
  } else {
    cs = 'not configured';
  }
  ILI9341.print(5, ILI9341.line(2), 'Cloud: ' + cs + '         ');
}

function printTime() {
  ILI9341.setFont(fonts[1]);
  ILI9341.setFgColor565(ILI9341.WHITE);
  let ts = formatTime('%H:%M:%S');
  ILI9341.print(5, ILI9341.line(3), 'Time: ' + (ts ? ts : 'not set') + '   ');
}

function printGreeting() {
  ILI9341.setFont(fonts[1]);
  ILI9341.setFgColor565(ILI9341.WHITE);
  if (greeting) {
    printCentered(160, ILI9341.line(5), greeting);
  } else {
    clearLine(5);
  }
}

function printBtnStatus() {
  ILI9341.setFont(fonts[2]);
  ILI9341.setFgColor565(ILI9341.WHITE);
  let y = ILI9341.line(-1);
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

function watsonReportBtnStatus() {
  // Make sure BTN1 is always reported first, to make the QuickStart graph deterministic.
  Watson.sendEventJSON('btnStatus', {d:{btn1: btnc[1]}});
  Watson.sendEventJSON('btnStatus', {d:{btn2: btnc[2], btn3: btnc[3]}});
}

function reportBtnPress(n) {
  btnc[n] = btnc[n] + 1;

  let btns = JSON.stringify(n);
  let msg = JSON.stringify({btn: n, cnt: btnc[n]});
  if (cloudName === 'Azure') {
    Azure.sendD2CMsg('btn=' + btns, msg);
  } else if (cloudName === 'Watson') {
    watsonReportBtnStatus();
  } else {
    MQTT.pub(devID + '/messages', msg);
  }
  let upd = {};
  upd["btn" + btns] = btnc[n];
  Shadow.update(0, upd);
  printBtnStatus();
}

GPIO.set_button_handler(BTN1, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 20, function() { reportBtnPress(1) }, null);
GPIO.set_button_handler(BTN2, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 20, function() { reportBtnPress(2) }, null);
GPIO.set_button_handler(BTN3, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 20, function() { reportBtnPress(3) }, null);
RPC.addHandler('M5.SetGreeting', function(args) {
  if (args.greeting === undefined) {
    return {"error": 400, "message": "greeting not specified"};
  }
  ILI9341.setFont(fonts[1]);
  greeting = '';
  printGreeting();
  greeting = args.greeting;
  printGreeting();
});

Shadow.addHandler(function(ev, obj) {
  print(ev, JSON.stringify(obj));
  if (ev === 'CONNECTED') {
    // Nothing. A GET will be delivered shortly.
  } else if (ev === 'GET_ACCEPTED' && obj.reported !== undefined ) {
    btnc[1] = obj.reported.btn1 || 0;
    btnc[2] = obj.reported.btn2 || 0;
    btnc[3] = obj.reported.btn3 || 0;
    if (obj.desired !== undefined && obj.desired.greeting !== undefined) {
      greeting = obj.desired.greeting;
    }
  } else if (ev === 'UPDATE_DELTA') {
    if (obj.greeting !== undefined) greeting = obj.greeting;
  }
});

printStatus();
Timer.set(1000 /* 1 sec */, Timer.REPEAT, printStatus, null);
