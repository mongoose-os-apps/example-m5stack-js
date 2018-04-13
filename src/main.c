/*
 * Copyright (c) 2014-2018 Cesanta Software Limited
 * All rights reserved
 *
 * Licensed under the Apache License, Version 2.0 (the ""License"");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an ""AS IS"" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include <time.h>

#include "mgos_ili9341.h"
#include "fonts/FreeSerif9pt7b.h"
#include "fonts/FreeSerif12pt7b.h"
#include "fonts/FreeSerif18pt7b.h"
#include "fonts/FreeSerif24pt7b.h"

GFXfont *get_font(int n) {
  switch (n) {
    case 0:
      return &FreeSerif9pt7b;
    case 1:
      return &FreeSerif12pt7b;
    case 2:
      return &FreeSerif18pt7b;
    case 3:
      return &FreeSerif24pt7b;
  }
  return NULL;
}

const char *format_time(const char *fmt) {
  static char buf[32];
  time_t now = time(NULL);
  struct tm tm;
  if (now < 1500000000) return NULL;
  if (localtime_r(&now, &tm) == NULL) return NULL;
  strftime(buf, sizeof(buf), fmt, &tm);
  return buf;
}
