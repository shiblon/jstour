'use strict';

function CodeCtrl($scope, $http, $location, $timeout) {
  $scope.mirror = CodeMirror.fromTextArea($('#codetext')[0], {
      mode: 'javascript',
      lineNumbers: true,
      theme: 'neat',
      indentUnit: 2,
      extraKeys: {
        'Tab': 'indentMore',
        'Shift-Enter': false,
      },
  });

  $(document).keydown(function(event) {
    var e = window.event || event;
    if (e.keyCode == 13 && e.shiftKey) {  // shift-enter
      $scope.runCode();
      $scope.$apply();
      return false;
    } else if (e.keyCode == 33) {  // page up
      $scope.location.path("/" + $scope.prevChapter());
      $scope.$apply();
      return false;
    } else if (e.keyCode == 34) {  // page down
      $scope.location.path("/" + $scope.nextChapter());
      $scope.$apply();
      return false;
    }
  });

  window.showdiff = function() {
    var win = window.open("", null, "height=400,width=400");
    var cmerge = new CodeMirror.MergeView(win.document.body, {
      origLeft: $scope.tutorial.code,
      origRight: $scope.code(),
    });
  };

  $scope.code = function(code) {
    if (code === undefined) {
      return $scope.mirror.getValue();
    }
    $scope.mirror.setValue(code);
  };

  $scope.location = $location;
  $scope.canvas = null;
  $scope.defaultMode = "javascript";

  // This naively assumes that the dirty state is "sticky" unless you force a
  // full recomputation. Works for most purposes in the UI.
  $scope._dirty = false;
  $scope.dirty = function(force_recompute) {
    if (force_recompute || !$scope._dirty) {
      $scope._dirty = ($scope.tutorial != undefined &&
                       $scope.code() != $scope.tutorial.code);
    }
    return $scope._dirty;
  };

  $scope.storageKey = function() {
    return "jstour-" + $scope.tutorial.name;
  };

  $scope.saveCode = function() {
    if ($scope.tutorial === undefined) {
      return;
    }
    var dirty = $scope.dirty(true);

    // Save to the internal JS cache first.
    $scope.tutorial.userCode = (dirty) ? $scope.code() : undefined;

    // Also save to HTML5 local storage if possible.
    // This protects users against refresh and browser crashes.
    if (typeof(Storage) != "undefined") {
      if ($scope.tutorial.userCode === undefined) {
        localStorage.removeItem($scope.storageKey());
      } else {
        localStorage[$scope.storageKey()] = JSON.stringify({
          time_ms: +new Date(),
          user_code: $scope.tutorial.userCode,
        });
      }
    }
  };

  $scope.loadCode = function() {
    if ($scope.tutorial === undefined) {
      return;
    }

    // Get from localStorage if possible.
    if (typeof(Storage) != "undefined") {
      var val = localStorage[$scope.storageKey()];
      if (val !== undefined) {
        // TODO: Age out old things?
        $scope.tutorial.userCode = JSON.parse(val).user_code;
      }
    }
    // If there is data in userCode now, then we display that. Otherwise we get
    // the tutorial code and display that.
    if ($scope.tutorial.userCode !== undefined) {
      $scope.code($scope.tutorial.userCode);
    } else {
      $scope.code($scope.tutorial.code);
    }
    $scope.dirty(true);  // Force dirty bit recomputation.
  };
  // TOC should be off when we start.
  $scope.tocShowing = false;

  // Get the tutorials out of the document itself.
  (function() {
    var lineSplit = function(text) {
      return text.split(/\r?\n/);
    };
    var trimBlanks = function(lines) {
      var start = 0;
      for (var i = 0, len = lines.length; i < len; i++) {
        var line = lines[i];
        if (line.trim() != "") {
          start = i;
          break;
        }
      }
      var end = start;
      for (i = start, len = lines.length; i < len; i++) {
        var line = lines[i];
        if (line.trim() != "") {
          end = i + 1;
        }
      }
      return lines.slice(start, end);
    };
    var dedent = function(lines) {
      if (lines.length == 0) {
        return [];
      }
      var dedented = [];
      var info = /^\s*/.exec(lines[0]);
      var prefix = info[0];
      var prefixRe = new RegExp("^" + prefix);
      for (var i = 0, len = lines.length; i < len; i++) {
        dedented.push(lines[i].replace(prefixRe, ''));
      }
      return dedented;
    };
    var splitProseAndCode = function(lines) {
      var sep = -1;
      for (var i = 0, len = lines.length; i < len; i++) {
        var line = lines[i];
        if (line.match(/^--\s*$/)) {
          sep = i;
          break;
        }
      }
      if (sep >= 0) {
        var prose = trimBlanks(lines.slice(0, sep));
        var code = trimBlanks(lines.slice(sep + 1));
        return {'prose': prose.join('\n'), 'code': code.join('\n')};
      }
      return {'prose': lines.join('\n'), 'code': ''};
    };
    var rawChapters = $("#chapter-contents div");
    var numChapters = rawChapters.length;

    var chapterObjs = [];

    for (var c = 0; c < numChapters; c++) {
      var chapter = $(rawChapters[c]);
      var title = chapter.attr('name');
      var text = chapter.text();

      var lines = dedent(trimBlanks(lineSplit(text)));
      var data = splitProseAndCode(lines);
      var prose = data.prose;
      var code = data.code;

      chapterObjs.push({
        'name': title,
        'index': c,
        'title': title,
        'description': prose,
        'code': code,
      });
    }
    $scope.tutorials = chapterObjs;
    // Call this instead of accessing $scope.tutorials directly.
    // This allows us, if we want, to change settings for each page.
    function loadTutorial(index) {
      return $scope.tutorials[index];
    }
    $scope.tutorial = loadTutorial($scope.chapter - 1);
    $scope.loadCode();

    // Redirect to the first page if none is specified.
    if (!$location.path()) {
      $location.path('/1').replace();
    }

    // Notice when the path changes and use that to
    // navigate, but only after we actually have
    // data.
    $scope.$watch('location.path()', function(path) {
      var newChapter = +path.replace(/^[/]/, '');
      if (newChapter == 0) {
        // Special value - don't go to chapter 0.
        newChapter = $scope.chapter;
        $scope.location.path("/" + $scope.chapter).replace();
      }
      $scope.tocShowing = false;
      if (newChapter != $scope.chapter) {
        $scope.saveCode();
        $scope.chapter = newChapter;
        $scope.tutorial = loadTutorial(newChapter - 1);
        $scope.loadCode();
        $scope.clearOutput();
        $(document.body).scrollTop(0);
      }
    });
  })();

  // Set up a handy timer that watches when _time changes and starts a new
  // timeout to change it. It's a bit more elegant than creating a function
  // and creating a timeout from a timeout.
  $scope._time = new Date();
  $scope.$watch('_time', function() {
    $scope.saveCode();  // Also forces dirty bit recomputation.
    $timeout(function(){
      $scope._time = new Date();
    }, 1000);
  });

  $scope.runCode = function() {
    $scope.clearOutput();
    window._output = function(text) {
      var args = [];
      for (var i = 0; i < arguments.length; i++) {
        args.push(arguments[i]);
      }
      $scope.addOutputText(args.join(" "));
    };
    window._canvas = function(width, height) {
      var canvas = document.getElementById("_canvas");
      if (!canvas) {
        var container = document.getElementById("output");
        canvas = document.createElement("canvas");
        if (width === undefined) {
          width = 200;
        }
        if (height === undefined) {
          height = 200;
        }
        canvas.width = width;
        canvas.height = height;
        canvas.style.border = "1px solid black";
        container.insertBefore(canvas, container.firstChild);
      }
      if (!(width === undefined || width == null || width == canvas.width)) {
        canvas.width = width;
      }
      if (!(height === undefined || height == null || height == canvas.height)) {
        canvas.height = height;
      }
      return canvas;
    };
    window._canvas_window = function(width, height, name) {
      if (name === undefined) {
        name = "canvasWindow";
      }
      var win = window.open("", name, "height=" + height + ",width=" + width);
      win.focus();
      win.document.body.style.margin = "0";
      win.document.body.style.padding = "0";
      var canvas = win.document.getElementById("_canvas_");

      if (!canvas) {
        // Create and add a canvas.
        var canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.id = "_canvas_";
        win.document.body.appendChild(canvas);
      }

      return {
        "window": win,
        "canvas": canvas,
        "context": canvas.getContext('2d'),
      };
    };
    window._animation_loop = function(callback) {
      var last_ts = null;
      var repeat = true;
      function step(ts) {
        if (last_ts == null) {
          last_ts = ts;
        }
        if (!repeat) {
          return;
        }
        var ret = callback(ts, ts - last_ts);
        if (ret === false) {
          return;
        }
        requestAnimationFrame(step);
        last_ts = ts;
      }
      requestAnimationFrame(step);
      return function() { repeat = false; };
    };
    window._fill_rect = function(context, x, y, w, h, color) {
      // Since this is in a function, we want to
      // leave things the way we found them. Nobody
      // would expect to call this and have the global
      // fill style suddenly changed.
      context.save();
      context.fillStyle = color;
      context.fillRect(x, y, w, h);
      context.restore();
    };
    window._fill_circle = function(context, x, y, radius, color) {
      context.save()
      context.fillStyle = color;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2, true);
      context.fill();
      context.restore();
    };
    window._big_bang = function(width, height, config) {
      function get_wc() {
        var NAME = "big_bang_window_";
        wc = _canvas_window(width, height, NAME);
        if (wc.window._running_big_bang_) {
          wc.window.close();
          wc = _canvas_window(width, height, NAME);
        }
        wc.window._running_big_bang_ = true;
        return wc
      }

      var wc = get_wc();

      var tick = config.tick || function() {};
      var draw = config.draw || function() {};

      var interval = config.interval;
      if (!interval || interval < 0) {
        interval = 0;
      }

      if (config.keyinput) {
        wc.window.addEventListener("keypress", config.keyinput);
        wc.window.addEventListener("keydown", config.keyinput);
        wc.window.addEventListener("keyup", config.keyinput);
      }

      if (config.mouseinput) {
        wc.window.addEventListener("mousedown", config.mouseinput);
        wc.window.addEventListener("mouseup", config.mouseinput);
        wc.window.addEventListener("mousemove", config.mouseinput);
      }

      var tnext = null;
      var stop = _animation_loop(function(ts, delta_t) {
        if (wc.window.closed) {
          return false;
        }
        if (tnext == null) {
          tnext = ts;
        }
        if (!interval || ts >= tnext) {
          tnext += interval;
          if (false === tick(ts, delta_t)) {
            return false;
          }
        }
        if (false === draw(wc.canvas, wc.context)) {
          return false;
        }
        return true;
      });

      wc.window.addEventListener("close", stop);
    };
    try {
      eval($scope.code());
    } catch(err) {
      console.log(err);
      $scope.addErrorText($scope.prettyError(err));
    }
  };

  // This is useful for binding keys in the code window to do
  // nothing at all. We can't, for whatever reason, define this
  // function in-line.
  //
  // Note that we use this for Shift-Enter because it is a
  // document-wide keystroke that should run the code, but if
  // you're in the code window it causes a newline to be
  // inserted, too.
  $scope.doNothing = function(e) {}

  $scope.clearOutput = function() {
    var output = document.getElementById("output");
    while (output.lastChild) {
      output.removeChild(output.lastChild);
    }
  };

  $scope.prettyError = function(err) {
    // If we are dealing with Firefox, just output the message.
    if (err.stack[0] == '@') {
      return err.name + ": " + err.message;
    }
    var lines = err.stack.split(/\r\n|\r|\n/);
    var output = [lines[0]];
    // Now only keep lines that have <anonymous> as the file name, and filter
    // out irrelevant text from those.
    for (var i = 1; i < lines.length; i++) {
      var line = lines[i];
      if (line.match(/^\s*at .*runCode/)) {
        break;
      }
      line = line.replace(/\([^()]*\)/, '');
      line = line.replace(/\s*\(.*:(\d+):(\d+)\)$/, ":$1:$2");
      line = line.replace("Object.eval", "_Main_");
      output.push(line);
    }
    return output.join("\n");
  };

  $scope.addOutputText = function(text) {
    $scope._addText(text, "stdout");
  };

  $scope.addErrorText = function(text) {
    $scope._addText(text, "stderr");
  };

  $scope._addText = function(text, elementClass) {
    var output = document.getElementById("output");
    var scrolled = output.scrollHeight - output.clientHeight - output.scrollTop;
    console.log(scrolled);
    var scrollDown = scrolled < 12;
    var pre = document.createElement("pre");
    pre.setAttribute("class", elementClass);
    pre.appendChild(document.createTextNode(text));
    output.appendChild(pre);
    if (scrollDown) {
      output.scrollTop = output.scrollHeight - output.clientHeight;
    }
  };

  $scope.clearCode = function() {
    $scope.code("");
  }

  $scope.revertCode = function() {
    $scope.code($scope.tutorial.code);
    // Force dirty bit recomputation:
    $scope.dirty(true);
  };

  $scope.revertAll = function() {
    // Remove all local storage if we have it.
    if (typeof(Storage) != "undefined") {
      localStorage.clear();
    }
    $scope.revertCode();
  };

  $scope.prevChapter = function() {
    if ($scope.tutorial == undefined || $scope.tutorial.index <= 0) {
      return 0;  // special value meaning don't go there.
    }
    return $scope.tutorial.index;  // chapter - 1
  }

  $scope.nextChapter = function() {
    if ($scope.tutorial == undefined ||
        $scope.tutorial.index >= $scope.tutorials.length - 1) {
      return 0;  // special value - don't go there.
    }
    return $scope.tutorial.index + 2;  // chapter + 1
  }
}
