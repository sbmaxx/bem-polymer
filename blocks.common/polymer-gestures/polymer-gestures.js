/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
window.PolymerGestures = {};

(function(scope) {
  var HAS_FULL_PATH = false;

  // test for full event path support
  var pathTest = document.createElement('meta');
  if (pathTest.createShadowRoot) {
    var sr = pathTest.createShadowRoot();
    var s = document.createElement('span');
    sr.appendChild(s);
    pathTest.addEventListener('testpath', function(ev) {
      if (ev.path) {
        // if the span is in the event path, then path[0] is the real source for all events
        HAS_FULL_PATH = ev.path[0] === s;
      }
      ev.stopPropagation();
    });
    var ev = new CustomEvent('testpath', {bubbles: true});
    // must add node to DOM to trigger event listener
    document.head.appendChild(pathTest);
    s.dispatchEvent(ev);
    pathTest.parentNode.removeChild(pathTest);
    sr = s = null;
  }
  pathTest = null;

  var target = {
    shadow: function(inEl) {
      if (inEl) {
        return inEl.shadowRoot || inEl.webkitShadowRoot;
      }
    },
    canTarget: function(shadow) {
      return shadow && Boolean(shadow.elementFromPoint);
    },
    targetingShadow: function(inEl) {
      var s = this.shadow(inEl);
      if (this.canTarget(s)) {
        return s;
      }
    },
    olderShadow: function(shadow) {
      var os = shadow.olderShadowRoot;
      if (!os) {
        var se = shadow.querySelector('shadow');
        if (se) {
          os = se.olderShadowRoot;
        }
      }
      return os;
    },
    allShadows: function(element) {
      var shadows = [], s = this.shadow(element);
      while(s) {
        shadows.push(s);
        s = this.olderShadow(s);
      }
      return shadows;
    },
    searchRoot: function(inRoot, x, y) {
      var t, st, sr, os;
      if (inRoot) {
        t = inRoot.elementFromPoint(x, y);
        if (t) {
          // found element, check if it has a ShadowRoot
          sr = this.targetingShadow(t);
        } else if (inRoot !== document) {
          // check for sibling roots
          sr = this.olderShadow(inRoot);
        }
        // search other roots, fall back to light dom element
        return this.searchRoot(sr, x, y) || t;
      }
    },
    owner: function(element) {
      if (!element) {
        return document;
      }
      var s = element;
      // walk up until you hit the shadow root or document
      while (s.parentNode) {
        s = s.parentNode;
      }
      // the owner element is expected to be a Document or ShadowRoot
      if (s.nodeType != Node.DOCUMENT_NODE && s.nodeType != Node.DOCUMENT_FRAGMENT_NODE) {
        s = document;
      }
      return s;
    },
    findTarget: function(inEvent) {
      if (HAS_FULL_PATH && inEvent.path) {
        return inEvent.path[0];
      }
      var x = inEvent.clientX, y = inEvent.clientY;
      // if the listener is in the shadow root, it is much faster to start there
      var s = this.owner(inEvent.target);
      // if x, y is not in this root, fall back to document search
      if (!s.elementFromPoint(x, y)) {
        s = document;
      }
      return this.searchRoot(s, x, y);
    },
    findTouchAction: function(inEvent) {
      var n;
      if (HAS_FULL_PATH && inEvent.path) {
        var path = inEvent.path;
        for (var i = 0; i < path.length; i++) {
          n = path[i];
          if (n.nodeType === Node.ELEMENT_NODE && n.hasAttribute('touch-action')) {
            return n.getAttribute('touch-action');
          }
        }
      } else {
        n = inEvent.target;
        while(n) {
          if (n.hasAttribute('touch-action')) {
            return n.getAttribute('touch-action');
          }
          n = n.parentNode || n.host;
        }
      }
      // auto is default
      return "auto";
    },
    LCA: function(a, b) {
      if (a === b) {
        return a;
      }
      if (a && !b) {
        return a;
      }
      if (b && !a) {
        return b;
      }
      if (!b && !a) {
        return document;
      }
      // fast case, a is a direct descendant of b or vice versa
      if (a.contains && a.contains(b)) {
        return a;
      }
      if (b.contains && b.contains(a)) {
        return b;
      }
      var adepth = this.depth(a);
      var bdepth = this.depth(b);
      var d = adepth - bdepth;
      if (d >= 0) {
        a = this.walk(a, d);
      } else {
        b = this.walk(b, -d);
      }
      while (a && b && a !== b) {
        a = a.parentNode || a.host;
        b = b.parentNode || b.host;
      }
      return a;
    },
    walk: function(n, u) {
      for (var i = 0; n && (i < u); i++) {
        n = n.parentNode || n.host;
      }
      return n;
    },
    depth: function(n) {
      var d = 0;
      while(n) {
        d++;
        n = n.parentNode || n.host;
      }
      return d;
    },
    deepContains: function(a, b) {
      var common = this.LCA(a, b);
      // if a is the common ancestor, it must "deeply" contain b
      return common === a;
    },
    insideNode: function(node, x, y) {
      var rect = node.getBoundingClientRect();
      return (rect.left <= x) && (x <= rect.right) && (rect.top <= y) && (y <= rect.bottom);
    }
  };
  scope.targetFinding = target;
  /**
   * Given an event, finds the "deepest" node that could have been the original target before ShadowDOM retargetting
   *
   * @param {Event} Event An event object with clientX and clientY properties
   * @return {Element} The probable event origninator
   */
  scope.findTarget = target.findTarget.bind(target);
  /**
   * Determines if the "container" node deeply contains the "containee" node, including situations where the "containee" is contained by one or more ShadowDOM
   * roots.
   *
   * @param {Node} container
   * @param {Node} containee
   * @return {Boolean}
   */
  scope.deepContains = target.deepContains.bind(target);

  /**
   * Determines if the x/y position is inside the given node.
   *
   * Example:
   *
   *     function upHandler(event) {
   *       var innode = PolymerGestures.insideNode(event.target, event.clientX, event.clientY);
   *       if (innode) {
   *         // wait for tap?
   *       } else {
   *         // tap will never happen
   *       }
   *     }
   *
   * @param {Node} node
   * @param {Number} x Screen X position
   * @param {Number} y screen Y position
   * @return {Boolean}
   */
  scope.insideNode = target.insideNode;

})(window.PolymerGestures);

(function() {
  function shadowSelector(v) {
    return 'html /deep/ ' + selector(v);
  }
  function selector(v) {
    return '[touch-action="' + v + '"]';
  }
  function rule(v) {
    return '{ -ms-touch-action: ' + v + '; touch-action: ' + v + ';}';
  }
  var attrib2css = [
    'none',
    'auto',
    'pan-x',
    'pan-y',
    {
      rule: 'pan-x pan-y',
      selectors: [
        'pan-x pan-y',
        'pan-y pan-x'
      ]
    },
    'manipulation'
  ];
  var styles = '';
  // only install stylesheet if the browser has touch action support
  var hasTouchAction = typeof document.head.style.touchAction === 'string';
  // only add shadow selectors if shadowdom is supported
  var hasShadowRoot = !window.ShadowDOMPolyfill && document.head.createShadowRoot;

  if (hasTouchAction) {
    attrib2css.forEach(function(r) {
      if (String(r) === r) {
        styles += selector(r) + rule(r) + '\n';
        if (hasShadowRoot) {
          styles += shadowSelector(r) + rule(r) + '\n';
        }
      } else {
        styles += r.selectors.map(selector) + rule(r.rule) + '\n';
        if (hasShadowRoot) {
          styles += r.selectors.map(shadowSelector) + rule(r.rule) + '\n';
        }
      }
    });

    var el = document.createElement('style');
    el.textContent = styles;
    document.head.appendChild(el);
  }
})();

/**
 * This is the constructor for new PointerEvents.
 *
 * New Pointer Events must be given a type, and an optional dictionary of
 * initialization properties.
 *
 * Due to certain platform requirements, events returned from the constructor
 * identify as MouseEvents.
 *
 * @constructor
 * @param {String} inType The type of the event to create.
 * @param {Object} [inDict] An optional dictionary of initial event properties.
 * @return {Event} A new PointerEvent of type `inType` and initialized with properties from `inDict`.
 */
(function(scope) {

  var MOUSE_PROPS = [
    'bubbles',
    'cancelable',
    'view',
    'detail',
    'screenX',
    'screenY',
    'clientX',
    'clientY',
    'ctrlKey',
    'altKey',
    'shiftKey',
    'metaKey',
    'button',
    'relatedTarget',
    'pageX',
    'pageY'
  ];

  var MOUSE_DEFAULTS = [
    false,
    false,
    null,
    null,
    0,
    0,
    0,
    0,
    false,
    false,
    false,
    false,
    0,
    null,
    0,
    0
  ];

  var NOP_FACTORY = function(){ return function(){}; };

  var eventFactory = {
    // TODO(dfreedm): this is overridden by tap recognizer, needs review
    preventTap: NOP_FACTORY,
    makeBaseEvent: function(inType, inDict) {
      var e = document.createEvent('Event');
      e.initEvent(inType, inDict.bubbles || false, inDict.cancelable || false);
      e.preventTap = eventFactory.preventTap(e);
      return e;
    },
    makeGestureEvent: function(inType, inDict) {
      inDict = inDict || Object.create(null);

      var e = this.makeBaseEvent(inType, inDict);
      for (var i = 0, keys = Object.keys(inDict), k; i < keys.length; i++) {
        k = keys[i];
        e[k] = inDict[k];
      }
      return e;
    },
    makePointerEvent: function(inType, inDict) {
      inDict = inDict || Object.create(null);

      var e = this.makeBaseEvent(inType, inDict);
      // define inherited MouseEvent properties
      for(var i = 0, p; i < MOUSE_PROPS.length; i++) {
        p = MOUSE_PROPS[i];
        e[p] = inDict[p] || MOUSE_DEFAULTS[i];
      }
      e.buttons = inDict.buttons || 0;

      // Spec requires that pointers without pressure specified use 0.5 for down
      // state and 0 for up state.
      var pressure = 0;
      if (inDict.pressure) {
        pressure = inDict.pressure;
      } else {
        pressure = e.buttons ? 0.5 : 0;
      }

      // add x/y properties aliased to clientX/Y
      e.x = e.clientX;
      e.y = e.clientY;

      // define the properties of the PointerEvent interface
      e.pointerId = inDict.pointerId || 0;
      e.width = inDict.width || 0;
      e.height = inDict.height || 0;
      e.pressure = pressure;
      e.tiltX = inDict.tiltX || 0;
      e.tiltY = inDict.tiltY || 0;
      e.pointerType = inDict.pointerType || '';
      e.hwTimestamp = inDict.hwTimestamp || 0;
      e.isPrimary = inDict.isPrimary || false;
      e._source = inDict._source || '';
      return e;
    }
  };

  scope.eventFactory = eventFactory;
})(window.PolymerGestures);

/**
 * This module implements an map of pointer states
 */
(function(scope) {
  var USE_MAP = window.Map && window.Map.prototype.forEach;
  var POINTERS_FN = function(){ return this.size; };
  function PointerMap() {
    if (USE_MAP) {
      var m = new Map();
      m.pointers = POINTERS_FN;
      return m;
    } else {
      this.keys = [];
      this.values = [];
    }
  }

  PointerMap.prototype = {
    set: function(inId, inEvent) {
      var i = this.keys.indexOf(inId);
      if (i > -1) {
        this.values[i] = inEvent;
      } else {
        this.keys.push(inId);
        this.values.push(inEvent);
      }
    },
    has: function(inId) {
      return this.keys.indexOf(inId) > -1;
    },
    'delete': function(inId) {
      var i = this.keys.indexOf(inId);
      if (i > -1) {
        this.keys.splice(i, 1);
        this.values.splice(i, 1);
      }
    },
    get: function(inId) {
      var i = this.keys.indexOf(inId);
      return this.values[i];
    },
    clear: function() {
      this.keys.length = 0;
      this.values.length = 0;
    },
    // return value, key, map
    forEach: function(callback, thisArg) {
      this.values.forEach(function(v, i) {
        callback.call(thisArg, v, this.keys[i], this);
      }, this);
    },
    pointers: function() {
      return this.keys.length;
    }
  };

  scope.PointerMap = PointerMap;
})(window.PolymerGestures);

(function(scope) {
  var CLONE_PROPS = [
    // MouseEvent
    'bubbles',
    'cancelable',
    'view',
    'detail',
    'screenX',
    'screenY',
    'clientX',
    'clientY',
    'ctrlKey',
    'altKey',
    'shiftKey',
    'metaKey',
    'button',
    'relatedTarget',
    // DOM Level 3
    'buttons',
    // PointerEvent
    'pointerId',
    'width',
    'height',
    'pressure',
    'tiltX',
    'tiltY',
    'pointerType',
    'hwTimestamp',
    'isPrimary',
    // event instance
    'type',
    'target',
    'currentTarget',
    'which',
    'pageX',
    'pageY',
    'timeStamp',
    // gesture addons
    'preventTap',
    'tapPrevented',
    '_source'
  ];

  var CLONE_DEFAULTS = [
    // MouseEvent
    false,
    false,
    null,
    null,
    0,
    0,
    0,
    0,
    false,
    false,
    false,
    false,
    0,
    null,
    // DOM Level 3
    0,
    // PointerEvent
    0,
    0,
    0,
    0,
    0,
    0,
    '',
    0,
    false,
    // event instance
    '',
    null,
    null,
    0,
    0,
    0,
    0,
    function(){},
    false
  ];

  var HAS_SVG_INSTANCE = (typeof SVGElementInstance !== 'undefined');

  var eventFactory = scope.eventFactory;

  // set of recognizers to run for the currently handled event
  var currentGestures;

  /**
   * This module is for normalizing events. Mouse and Touch events will be
   * collected here, and fire PointerEvents that have the same semantics, no
   * matter the source.
   * Events fired:
   *   - pointerdown: a pointing is added
   *   - pointerup: a pointer is removed
   *   - pointermove: a pointer is moved
   *   - pointerover: a pointer crosses into an element
   *   - pointerout: a pointer leaves an element
   *   - pointercancel: a pointer will no longer generate events
   */
  var dispatcher = {
    pointermap: new scope.PointerMap(),
    requiredGestures: new scope.PointerMap(),
    eventMap: Object.create(null),
    // Scope objects for native events.
    // This exists for ease of testing.
    eventSources: Object.create(null),
    eventSourceList: [],
    gestures: [],
    // map gesture event -> {listeners: int, index: gestures[int]}
    dependencyMap: {
      // make sure down and up are in the map to trigger "register"
      down: {listeners: 0, index: -1},
      up: {listeners: 0, index: -1}
    },
    gestureQueue: [],
    /**
     * Add a new event source that will generate pointer events.
     *
     * `inSource` must contain an array of event names named `events`, and
     * functions with the names specified in the `events` array.
     * @param {string} name A name for the event source
     * @param {Object} source A new source of platform events.
     */
    registerSource: function(name, source) {
      var s = source;
      var newEvents = s.events;
      if (newEvents) {
        newEvents.forEach(function(e) {
          if (s[e]) {
            this.eventMap[e] = s[e].bind(s);
          }
        }, this);
        this.eventSources[name] = s;
        this.eventSourceList.push(s);
      }
    },
    registerGesture: function(name, source) {
      var obj = Object.create(null);
      obj.listeners = 0;
      obj.index = this.gestures.length;
      for (var i = 0, g; i < source.exposes.length; i++) {
        g = source.exposes[i].toLowerCase();
        this.dependencyMap[g] = obj;
      }
      this.gestures.push(source);
    },
    register: function(element, initial) {
      var l = this.eventSourceList.length;
      for (var i = 0, es; (i < l) && (es = this.eventSourceList[i]); i++) {
        // call eventsource register
        es.register.call(es, element, initial);
      }
    },
    unregister: function(element) {
      var l = this.eventSourceList.length;
      for (var i = 0, es; (i < l) && (es = this.eventSourceList[i]); i++) {
        // call eventsource register
        es.unregister.call(es, element);
      }
    },
    // EVENTS
    down: function(inEvent) {
      this.requiredGestures.set(inEvent.pointerId, currentGestures);
      this.fireEvent('down', inEvent);
    },
    move: function(inEvent) {
      // pipe move events into gesture queue directly
      inEvent.type = 'move';
      this.fillGestureQueue(inEvent);
    },
    up: function(inEvent) {
      this.fireEvent('up', inEvent);
      this.requiredGestures.delete(inEvent.pointerId);
    },
    cancel: function(inEvent) {
      inEvent.tapPrevented = true;
      this.fireEvent('up', inEvent);
      this.requiredGestures.delete(inEvent.pointerId);
    },
    // LISTENER LOGIC
    eventHandler: function(inEvent) {
      // This is used to prevent multiple dispatch of events from
      // platform events. This can happen when two elements in different scopes
      // are set up to create pointer events, which is relevant to Shadow DOM.

      var type = inEvent.type;

      // only generate the list of desired events on "down"
      if (type === 'touchstart' || type === 'mousedown' || type === 'pointerdown' || type === 'MSPointerDown') {
        if (!inEvent._handledByPG) {
          currentGestures = {};
        }
        // map gesture names to ordered set of recognizers
        var gesturesWanted = inEvent.currentTarget._pgEvents;
        if (gesturesWanted) {
          var gk = Object.keys(gesturesWanted);
          for (var i = 0, r, ri, g; i < gk.length; i++) {
            // gesture
            g = gk[i];
            if (gesturesWanted[g] > 0) {
              // lookup gesture recognizer
              r = this.dependencyMap[g];
              // recognizer index
              ri = r ? r.index : -1;
              currentGestures[ri] = true;
            }
          }
        }
      }

      if (inEvent._handledByPG) {
        return;
      }
      var fn = this.eventMap && this.eventMap[type];
      if (fn) {
        fn(inEvent);
      }
      inEvent._handledByPG = true;
    },
    // set up event listeners
    listen: function(target, events) {
      for (var i = 0, l = events.length, e; (i < l) && (e = events[i]); i++) {
        this.addEvent(target, e);
      }
    },
    // remove event listeners
    unlisten: function(target, events) {
      for (var i = 0, l = events.length, e; (i < l) && (e = events[i]); i++) {
        this.removeEvent(target, e);
      }
    },
    addEvent: function(target, eventName) {
      target.addEventListener(eventName, this.boundHandler);
    },
    removeEvent: function(target, eventName) {
      target.removeEventListener(eventName, this.boundHandler);
    },
    // EVENT CREATION AND TRACKING
    /**
     * Creates a new Event of type `inType`, based on the information in
     * `inEvent`.
     *
     * @param {string} inType A string representing the type of event to create
     * @param {Event} inEvent A platform event with a target
     * @return {Event} A PointerEvent of type `inType`
     */
    makeEvent: function(inType, inEvent) {
      var e = eventFactory.makePointerEvent(inType, inEvent);
      e.preventDefault = inEvent.preventDefault;
      e.tapPrevented = inEvent.tapPrevented;
      e._target = e._target || inEvent.target;
      return e;
    },
    // make and dispatch an event in one call
    fireEvent: function(inType, inEvent) {
      var e = this.makeEvent(inType, inEvent);
      return this.dispatchEvent(e);
    },
    /**
     * Returns a snapshot of inEvent, with writable properties.
     *
     * @param {Event} inEvent An event that contains properties to copy.
     * @return {Object} An object containing shallow copies of `inEvent`'s
     *    properties.
     */
    cloneEvent: function(inEvent) {
      var eventCopy = Object.create(null), p;
      for (var i = 0; i < CLONE_PROPS.length; i++) {
        p = CLONE_PROPS[i];
        eventCopy[p] = inEvent[p] || CLONE_DEFAULTS[i];
        // Work around SVGInstanceElement shadow tree
        // Return the <use> element that is represented by the instance for Safari, Chrome, IE.
        // This is the behavior implemented by Firefox.
        if (p === 'target' || p === 'relatedTarget') {
          if (HAS_SVG_INSTANCE && eventCopy[p] instanceof SVGElementInstance) {
            eventCopy[p] = eventCopy[p].correspondingUseElement;
          }
        }
      }
      // keep the semantics of preventDefault
      eventCopy.preventDefault = function() {
        inEvent.preventDefault();
      };
      return eventCopy;
    },
    /**
     * Dispatches the event to its target.
     *
     * @param {Event} inEvent The event to be dispatched.
     * @return {Boolean} True if an event handler returns true, false otherwise.
     */
    dispatchEvent: function(inEvent) {
      var t = inEvent._target;
      if (t) {
        t.dispatchEvent(inEvent);
        // clone the event for the gesture system to process
        // clone after dispatch to pick up gesture prevention code
        var clone = this.cloneEvent(inEvent);
        clone.target = t;
        this.fillGestureQueue(clone);
      }
    },
    gestureTrigger: function() {
      // process the gesture queue
      for (var i = 0, e, rg; i < this.gestureQueue.length; i++) {
        e = this.gestureQueue[i];
        rg = e._requiredGestures;
        for (var j = 0, g, fn; j < this.gestures.length; j++) {
          // only run recognizer if an element in the source event's path is listening for those gestures
          if (rg[j]) {
            g = this.gestures[j];
            fn = g[e.type];
            if (fn) {
              fn.call(g, e);
            }
          }
        }
      }
      this.gestureQueue.length = 0;
    },
    fillGestureQueue: function(ev) {
      // only trigger the gesture queue once
      if (!this.gestureQueue.length) {
        requestAnimationFrame(this.boundGestureTrigger);
      }
      ev._requiredGestures = this.requiredGestures.get(ev.pointerId);
      this.gestureQueue.push(ev);
    }
  };
  dispatcher.boundHandler = dispatcher.eventHandler.bind(dispatcher);
  dispatcher.boundGestureTrigger = dispatcher.gestureTrigger.bind(dispatcher);
  scope.dispatcher = dispatcher;

  /**
   * Listen for `gesture` on `node` with the `handler` function
   *
   * If `handler` is the first listener for `gesture`, the underlying gesture recognizer is then enabled.
   *
   * @param {Element} node
   * @param {string} gesture
   * @return Boolean `gesture` is a valid gesture
   */
  scope.activateGesture = function(node, gesture) {
    var g = gesture.toLowerCase();
    var dep = dispatcher.dependencyMap[g];
    if (dep) {
      var recognizer = dispatcher.gestures[dep.index];
      if (!node._pgListeners) {
        dispatcher.register(node);
        node._pgListeners = 0;
      }
      // TODO(dfreedm): re-evaluate bookkeeping to avoid using attributes
      if (recognizer) {
        var touchAction = recognizer.defaultActions && recognizer.defaultActions[g];
        var actionNode;
        switch(node.nodeType) {
          case Node.ELEMENT_NODE:
            actionNode = node;
          break;
          case Node.DOCUMENT_FRAGMENT_NODE:
            actionNode = node.host;
          break;
          default:
            actionNode = null;
          break;
        }
        if (touchAction && actionNode && !actionNode.hasAttribute('touch-action')) {
          actionNode.setAttribute('touch-action', touchAction);
        }
      }
      if (!node._pgEvents) {
        node._pgEvents = {};
      }
      node._pgEvents[g] = (node._pgEvents[g] || 0) + 1;
      node._pgListeners++;
    }
    return Boolean(dep);
  };

  /**
   *
   * Listen for `gesture` from `node` with `handler` function.
   *
   * @param {Element} node
   * @param {string} gesture
   * @param {Function} handler
   * @param {Boolean} capture
   */
  scope.addEventListener = function(node, gesture, handler, capture) {
    if (handler) {
      scope.activateGesture(node, gesture);
      node.addEventListener(gesture, handler, capture);
    }
  };

  /**
   * Tears down the gesture configuration for `node`
   *
   * If `handler` is the last listener for `gesture`, the underlying gesture recognizer is disabled.
   *
   * @param {Element} node
   * @param {string} gesture
   * @return Boolean `gesture` is a valid gesture
   */
  scope.deactivateGesture = function(node, gesture) {
    var g = gesture.toLowerCase();
    var dep = dispatcher.dependencyMap[g];
    if (dep) {
      if (node._pgListeners > 0) {
        node._pgListeners--;
      }
      if (node._pgListeners === 0) {
        dispatcher.unregister(node);
      }
      if (node._pgEvents) {
        if (node._pgEvents[g] > 0) {
          node._pgEvents[g]--;
        } else {
          node._pgEvents[g] = 0;
        }
      }
    }
    return Boolean(dep);
  };

  /**
   * Stop listening for `gesture` from `node` with `handler` function.
   *
   * @param {Element} node
   * @param {string} gesture
   * @param {Function} handler
   * @param {Boolean} capture
   */
  scope.removeEventListener = function(node, gesture, handler, capture) {
    if (handler) {
      scope.deactivateGesture(node, gesture);
      node.removeEventListener(gesture, handler, capture);
    }
  };
})(window.PolymerGestures);

(function (scope) {
  var dispatcher = scope.dispatcher;
  var pointermap = dispatcher.pointermap;
  // radius around touchend that swallows mouse events
  var DEDUP_DIST = 25;

  var WHICH_TO_BUTTONS = [0, 1, 4, 2];

  var HAS_BUTTONS = false;
  try {
    HAS_BUTTONS = new MouseEvent('test', {buttons: 1}).buttons === 1;
  } catch (e) {}

  // handler block for native mouse events
  var mouseEvents = {
    POINTER_ID: 1,
    POINTER_TYPE: 'mouse',
    events: [
      'mousedown',
      'mousemove',
      'mouseup'
    ],
    exposes: [
      'down',
      'up',
      'move'
    ],
    register: function(target) {
      dispatcher.listen(target, this.events);
    },
    unregister: function(target) {
      dispatcher.unlisten(target, this.events);
    },
    lastTouches: [],
    // collide with the global mouse listener
    isEventSimulatedFromTouch: function(inEvent) {
      var lts = this.lastTouches;
      var x = inEvent.clientX, y = inEvent.clientY;
      for (var i = 0, l = lts.length, t; i < l && (t = lts[i]); i++) {
        // simulated mouse events will be swallowed near a primary touchend
        var dx = Math.abs(x - t.x), dy = Math.abs(y - t.y);
        if (dx <= DEDUP_DIST && dy <= DEDUP_DIST) {
          return true;
        }
      }
    },
    prepareEvent: function(inEvent) {
      var e = dispatcher.cloneEvent(inEvent);
      e.pointerId = this.POINTER_ID;
      e.isPrimary = true;
      e.pointerType = this.POINTER_TYPE;
      e._source = 'mouse';
      if (!HAS_BUTTONS) {
        e.buttons = WHICH_TO_BUTTONS[e.which] || 0;
      }
      return e;
    },
    mousedown: function(inEvent) {
      if (!this.isEventSimulatedFromTouch(inEvent)) {
        var p = pointermap.has(this.POINTER_ID);
        // TODO(dfreedman) workaround for some elements not sending mouseup
        // http://crbug/149091
        if (p) {
          this.mouseup(inEvent);
        }
        var e = this.prepareEvent(inEvent);
        e.target = scope.findTarget(inEvent);
        pointermap.set(this.POINTER_ID, e.target);
        dispatcher.down(e);
      }
    },
    mousemove: function(inEvent) {
      if (!this.isEventSimulatedFromTouch(inEvent)) {
        var target = pointermap.get(this.POINTER_ID);
        if (target) {
          var e = this.prepareEvent(inEvent);
          e.target = target;
          // handle case where we missed a mouseup
          if (e.buttons === 0) {
            dispatcher.cancel(e);
            this.cleanupMouse();
          } else {
            dispatcher.move(e);
          }
        }
      }
    },
    mouseup: function(inEvent) {
      if (!this.isEventSimulatedFromTouch(inEvent)) {
        var e = this.prepareEvent(inEvent);
        e.relatedTarget = scope.findTarget(inEvent);
        e.target = pointermap.get(this.POINTER_ID);
        dispatcher.up(e);
        this.cleanupMouse();
      }
    },
    cleanupMouse: function() {
      pointermap['delete'](this.POINTER_ID);
    }
  };

  scope.mouseEvents = mouseEvents;
})(window.PolymerGestures);

(function(scope) {
  var dispatcher = scope.dispatcher;
  var allShadows = scope.targetFinding.allShadows.bind(scope.targetFinding);
  var pointermap = dispatcher.pointermap;
  var touchMap = Array.prototype.map.call.bind(Array.prototype.map);
  // This should be long enough to ignore compat mouse events made by touch
  var DEDUP_TIMEOUT = 2500;
  var CLICK_COUNT_TIMEOUT = 200;
  var HYSTERESIS = 20;
  var ATTRIB = 'touch-action';
  // TODO(dfreedm): disable until http://crbug.com/399765 is resolved
  // var HAS_TOUCH_ACTION = ATTRIB in document.head.style;
  var HAS_TOUCH_ACTION = false;

  // handler block for native touch events
  var touchEvents = {
    events: [
      'touchstart',
      'touchmove',
      'touchend',
      'touchcancel'
    ],
    exposes: [
      'down',
      'up',
      'move'
    ],
    register: function(target, initial) {
      if (initial) {
        return;
      }
      dispatcher.listen(target, this.events);
    },
    unregister: function(target) {
      dispatcher.unlisten(target, this.events);
    },
    scrollTypes: {
      EMITTER: 'none',
      XSCROLLER: 'pan-x',
      YSCROLLER: 'pan-y',
    },
    touchActionToScrollType: function(touchAction) {
      var t = touchAction;
      var st = this.scrollTypes;
      if (t === st.EMITTER) {
        return 'none';
      } else if (t === st.XSCROLLER) {
        return 'X';
      } else if (t === st.YSCROLLER) {
        return 'Y';
      } else {
        return 'XY';
      }
    },
    POINTER_TYPE: 'touch',
    firstTouch: null,
    isPrimaryTouch: function(inTouch) {
      return this.firstTouch === inTouch.identifier;
    },
    setPrimaryTouch: function(inTouch) {
      // set primary touch if there no pointers, or the only pointer is the mouse
      if (pointermap.pointers() === 0 || (pointermap.pointers() === 1 && pointermap.has(1))) {
        this.firstTouch = inTouch.identifier;
        this.firstXY = {X: inTouch.clientX, Y: inTouch.clientY};
        this.scrolling = null;
        this.cancelResetClickCount();
      }
    },
    removePrimaryPointer: function(inPointer) {
      if (inPointer.isPrimary) {
        this.firstTouch = null;
        this.firstXY = null;
        this.resetClickCount();
      }
    },
    clickCount: 0,
    resetId: null,
    resetClickCount: function() {
      var fn = function() {
        this.clickCount = 0;
        this.resetId = null;
      }.bind(this);
      this.resetId = setTimeout(fn, CLICK_COUNT_TIMEOUT);
    },
    cancelResetClickCount: function() {
      if (this.resetId) {
        clearTimeout(this.resetId);
      }
    },
    typeToButtons: function(type) {
      var ret = 0;
      if (type === 'touchstart' || type === 'touchmove') {
        ret = 1;
      }
      return ret;
    },
    findTarget: function(touch, id) {
      if (this.currentTouchEvent.type === 'touchstart') {
        if (this.isPrimaryTouch(touch)) {
          var fastPath = {
            clientX: touch.clientX,
            clientY: touch.clientY,
            path: this.currentTouchEvent.path,
            target: this.currentTouchEvent.target
          };
          return scope.findTarget(fastPath);
        } else {
          return scope.findTarget(touch);
        }
      }
      // reuse target we found in touchstart
      return pointermap.get(id);
    },
    touchToPointer: function(inTouch) {
      var cte = this.currentTouchEvent;
      var e = dispatcher.cloneEvent(inTouch);
      // Spec specifies that pointerId 1 is reserved for Mouse.
      // Touch identifiers can start at 0.
      // Add 2 to the touch identifier for compatibility.
      var id = e.pointerId = inTouch.identifier + 2;
      e.target = this.findTarget(inTouch, id);
      e.bubbles = true;
      e.cancelable = true;
      e.detail = this.clickCount;
      e.buttons = this.typeToButtons(cte.type);
      e.width = inTouch.webkitRadiusX || inTouch.radiusX || 0;
      e.height = inTouch.webkitRadiusY || inTouch.radiusY || 0;
      e.pressure = inTouch.webkitForce || inTouch.force || 0.5;
      e.isPrimary = this.isPrimaryTouch(inTouch);
      e.pointerType = this.POINTER_TYPE;
      e._source = 'touch';
      // forward touch preventDefaults
      var self = this;
      e.preventDefault = function() {
        self.scrolling = false;
        self.firstXY = null;
        cte.preventDefault();
      };
      return e;
    },
    processTouches: function(inEvent, inFunction) {
      var tl = inEvent.changedTouches;
      this.currentTouchEvent = inEvent;
      for (var i = 0, t, p; i < tl.length; i++) {
        t = tl[i];
        p = this.touchToPointer(t);
        if (inEvent.type === 'touchstart') {
          pointermap.set(p.pointerId, p.target);
        }
        if (pointermap.has(p.pointerId)) {
          inFunction.call(this, p);
        }
        if (inEvent.type === 'touchend' || inEvent._cancel) {
          this.cleanUpPointer(p);
        }
      }
    },
    // For single axis scrollers, determines whether the element should emit
    // pointer events or behave as a scroller
    shouldScroll: function(inEvent) {
      if (this.firstXY) {
        var ret;
        var touchAction = scope.targetFinding.findTouchAction(inEvent);
        var scrollAxis = this.touchActionToScrollType(touchAction);
        if (scrollAxis === 'none') {
          // this element is a touch-action: none, should never scroll
          ret = false;
        } else if (scrollAxis === 'XY') {
          // this element should always scroll
          ret = true;
        } else {
          var t = inEvent.changedTouches[0];
          // check the intended scroll axis, and other axis
          var a = scrollAxis;
          var oa = scrollAxis === 'Y' ? 'X' : 'Y';
          var da = Math.abs(t['client' + a] - this.firstXY[a]);
          var doa = Math.abs(t['client' + oa] - this.firstXY[oa]);
          // if delta in the scroll axis > delta other axis, scroll instead of
          // making events
          ret = da >= doa;
        }
        return ret;
      }
    },
    findTouch: function(inTL, inId) {
      for (var i = 0, l = inTL.length, t; i < l && (t = inTL[i]); i++) {
        if (t.identifier === inId) {
          return true;
        }
      }
    },
    // In some instances, a touchstart can happen without a touchend. This
    // leaves the pointermap in a broken state.
    // Therefore, on every touchstart, we remove the touches that did not fire a
    // touchend event.
    // To keep state globally consistent, we fire a
    // pointercancel for this "abandoned" touch
    vacuumTouches: function(inEvent) {
      var tl = inEvent.touches;
      // pointermap.pointers() should be < tl.length here, as the touchstart has not
      // been processed yet.
      if (pointermap.pointers() >= tl.length) {
        var d = [];
        pointermap.forEach(function(value, key) {
          // Never remove pointerId == 1, which is mouse.
          // Touch identifiers are 2 smaller than their pointerId, which is the
          // index in pointermap.
          if (key !== 1 && !this.findTouch(tl, key - 2)) {
            var p = value;
            d.push(p);
          }
        }, this);
        d.forEach(function(p) {
          this.cancel(p);
          pointermap.delete(p.pointerId);
        });
      }
    },
    touchstart: function(inEvent) {
      this.vacuumTouches(inEvent);
      this.setPrimaryTouch(inEvent.changedTouches[0]);
      this.dedupSynthMouse(inEvent);
      if (!this.scrolling) {
        this.clickCount++;
        this.processTouches(inEvent, this.down);
      }
    },
    down: function(inPointer) {
      dispatcher.down(inPointer);
    },
    touchmove: function(inEvent) {
      if (HAS_TOUCH_ACTION) {
        // touchevent.cancelable == false is sent when the page is scrolling under native Touch Action in Chrome 36
        // https://groups.google.com/a/chromium.org/d/msg/input-dev/wHnyukcYBcA/b9kmtwM1jJQJ
        if (inEvent.cancelable) {
          this.processTouches(inEvent, this.move);
        }
      } else {
        if (!this.scrolling) {
          if (this.scrolling === null && this.shouldScroll(inEvent)) {
            this.scrolling = true;
          } else {
            this.scrolling = false;
            inEvent.preventDefault();
            this.processTouches(inEvent, this.move);
          }
        } else if (this.firstXY) {
          var t = inEvent.changedTouches[0];
          var dx = t.clientX - this.firstXY.X;
          var dy = t.clientY - this.firstXY.Y;
          var dd = Math.sqrt(dx * dx + dy * dy);
          if (dd >= HYSTERESIS) {
            this.touchcancel(inEvent);
            this.scrolling = true;
            this.firstXY = null;
          }
        }
      }
    },
    move: function(inPointer) {
      dispatcher.move(inPointer);
    },
    touchend: function(inEvent) {
      this.dedupSynthMouse(inEvent);
      this.processTouches(inEvent, this.up);
    },
    up: function(inPointer) {
      inPointer.relatedTarget = scope.findTarget(inPointer);
      dispatcher.up(inPointer);
    },
    cancel: function(inPointer) {
      dispatcher.cancel(inPointer);
    },
    touchcancel: function(inEvent) {
      inEvent._cancel = true;
      this.processTouches(inEvent, this.cancel);
    },
    cleanUpPointer: function(inPointer) {
      pointermap['delete'](inPointer.pointerId);
      this.removePrimaryPointer(inPointer);
    },
    // prevent synth mouse events from creating pointer events
    dedupSynthMouse: function(inEvent) {
      var lts = scope.mouseEvents.lastTouches;
      var t = inEvent.changedTouches[0];
      // only the primary finger will synth mouse events
      if (this.isPrimaryTouch(t)) {
        // remember x/y of last touch
        var lt = {x: t.clientX, y: t.clientY};
        lts.push(lt);
        var fn = (function(lts, lt){
          var i = lts.indexOf(lt);
          if (i > -1) {
            lts.splice(i, 1);
          }
        }).bind(null, lts, lt);
        setTimeout(fn, DEDUP_TIMEOUT);
      }
    }
  };

  scope.touchEvents = touchEvents;
})(window.PolymerGestures);

(function(scope) {
  var dispatcher = scope.dispatcher;
  var pointermap = dispatcher.pointermap;
  var HAS_BITMAP_TYPE = window.MSPointerEvent && typeof window.MSPointerEvent.MSPOINTER_TYPE_MOUSE === 'number';
  var msEvents = {
    events: [
      'MSPointerDown',
      'MSPointerMove',
      'MSPointerUp',
      'MSPointerCancel',
    ],
    register: function(target) {
      dispatcher.listen(target, this.events);
    },
    unregister: function(target) {
      dispatcher.unlisten(target, this.events);
    },
    POINTER_TYPES: [
      '',
      'unavailable',
      'touch',
      'pen',
      'mouse'
    ],
    prepareEvent: function(inEvent) {
      var e = inEvent;
      e = dispatcher.cloneEvent(inEvent);
      if (HAS_BITMAP_TYPE) {
        e.pointerType = this.POINTER_TYPES[inEvent.pointerType];
      }
      e._source = 'ms';
      return e;
    },
    cleanup: function(id) {
      pointermap['delete'](id);
    },
    MSPointerDown: function(inEvent) {
      var e = this.prepareEvent(inEvent);
      e.target = scope.findTarget(inEvent);
      pointermap.set(inEvent.pointerId, e.target);
      dispatcher.down(e);
    },
    MSPointerMove: function(inEvent) {
      var target = pointermap.get(inEvent.pointerId);
      if (target) {
        var e = this.prepareEvent(inEvent);
        e.target = target;
        dispatcher.move(e);
      }
    },
    MSPointerUp: function(inEvent) {
      var e = this.prepareEvent(inEvent);
      e.relatedTarget = scope.findTarget(inEvent);
      e.target = pointermap.get(e.pointerId);
      dispatcher.up(e);
      this.cleanup(inEvent.pointerId);
    },
    MSPointerCancel: function(inEvent) {
      var e = this.prepareEvent(inEvent);
      e.relatedTarget = scope.findTarget(inEvent);
      e.target = pointermap.get(e.pointerId);
      dispatcher.cancel(e);
      this.cleanup(inEvent.pointerId);
    }
  };

  scope.msEvents = msEvents;
})(window.PolymerGestures);

(function(scope) {
  var dispatcher = scope.dispatcher;
  var pointermap = dispatcher.pointermap;
  var pointerEvents = {
    events: [
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel'
    ],
    prepareEvent: function(inEvent) {
      var e = dispatcher.cloneEvent(inEvent);
      e._source = 'pointer';
      return e;
    },
    register: function(target) {
      dispatcher.listen(target, this.events);
    },
    unregister: function(target) {
      dispatcher.unlisten(target, this.events);
    },
    cleanup: function(id) {
      pointermap['delete'](id);
    },
    pointerdown: function(inEvent) {
      var e = this.prepareEvent(inEvent);
      e.target = scope.findTarget(inEvent);
      pointermap.set(e.pointerId, e.target);
      dispatcher.down(e);
    },
    pointermove: function(inEvent) {
      var target = pointermap.get(inEvent.pointerId);
      if (target) {
        var e = this.prepareEvent(inEvent);
        e.target = target;
        dispatcher.move(e);
      }
    },
    pointerup: function(inEvent) {
      var e = this.prepareEvent(inEvent);
      e.relatedTarget = scope.findTarget(inEvent);
      e.target = pointermap.get(e.pointerId);
      dispatcher.up(e);
      this.cleanup(inEvent.pointerId);
    },
    pointercancel: function(inEvent) {
      var e = this.prepareEvent(inEvent);
      e.relatedTarget = scope.findTarget(inEvent);
      e.target = pointermap.get(e.pointerId);
      dispatcher.cancel(e);
      this.cleanup(inEvent.pointerId);
    }
  };

  scope.pointerEvents = pointerEvents;
})(window.PolymerGestures);

/**
 * This module contains the handlers for native platform events.
 * From here, the dispatcher is called to create unified pointer events.
 * Included are touch events (v1), mouse events, and MSPointerEvents.
 */
(function(scope) {
  var dispatcher = scope.dispatcher;
  var nav = window.navigator;

  if (window.PointerEvent) {
    dispatcher.registerSource('pointer', scope.pointerEvents);
  } else if (nav.msPointerEnabled) {
    dispatcher.registerSource('ms', scope.msEvents);
  } else {
    dispatcher.registerSource('mouse', scope.mouseEvents);
    if (window.ontouchstart !== undefined) {
      dispatcher.registerSource('touch', scope.touchEvents);
      /*
       * NOTE: an empty touch listener on body will reactivate nodes imported from templates with touch listeners
       * Removing it will re-break the nodes
       *
       * Work around for https://bugs.webkit.org/show_bug.cgi?id=135628
       */
      var isSafari = nav.userAgent.match('Safari') && !nav.userAgent.match('Chrome');
      if (isSafari) {
        document.body.addEventListener('touchstart', function(){});
      }
    }
  }
  dispatcher.register(document, true);
})(window.PolymerGestures);

/**
 * This event denotes the beginning of a series of tracking events.
 *
 * @module PointerGestures
 * @submodule Events
 * @class trackstart
 */
/**
 * Pixels moved in the x direction since trackstart.
 * @type Number
 * @property dx
 */
/**
 * Pixes moved in the y direction since trackstart.
 * @type Number
 * @property dy
 */
/**
 * Pixels moved in the x direction since the last track.
 * @type Number
 * @property ddx
 */
/**
 * Pixles moved in the y direction since the last track.
 * @type Number
 * @property ddy
 */
/**
 * The clientX position of the track gesture.
 * @type Number
 * @property clientX
 */
/**
 * The clientY position of the track gesture.
 * @type Number
 * @property clientY
 */
/**
 * The pageX position of the track gesture.
 * @type Number
 * @property pageX
 */
/**
 * The pageY position of the track gesture.
 * @type Number
 * @property pageY
 */
/**
 * The screenX position of the track gesture.
 * @type Number
 * @property screenX
 */
/**
 * The screenY position of the track gesture.
 * @type Number
 * @property screenY
 */
/**
 * The last x axis direction of the pointer.
 * @type Number
 * @property xDirection
 */
/**
 * The last y axis direction of the pointer.
 * @type Number
 * @property yDirection
 */
/**
 * A shared object between all tracking events.
 * @type Object
 * @property trackInfo
 */
/**
 * The element currently under the pointer.
 * @type Element
 * @property relatedTarget
 */
/**
 * The type of pointer that make the track gesture.
 * @type String
 * @property pointerType
 */
/**
 *
 * This event fires for all pointer movement being tracked.
 *
 * @class track
 * @extends trackstart
 */
/**
 * This event fires when the pointer is no longer being tracked.
 *
 * @class trackend
 * @extends trackstart
 */

 (function(scope) {
   var dispatcher = scope.dispatcher;
   var eventFactory = scope.eventFactory;
   var pointermap = new scope.PointerMap();
   var track = {
     events: [
       'down',
       'move',
       'up',
     ],
     exposes: [
      'trackstart',
      'track',
      'trackx',
      'tracky',
      'trackend'
     ],
     defaultActions: {
       'track': 'none',
       'trackx': 'pan-y',
       'tracky': 'pan-x'
     },
     WIGGLE_THRESHOLD: 4,
     clampDir: function(inDelta) {
       return inDelta > 0 ? 1 : -1;
     },
     calcPositionDelta: function(inA, inB) {
       var x = 0, y = 0;
       if (inA && inB) {
         x = inB.pageX - inA.pageX;
         y = inB.pageY - inA.pageY;
       }
       return {x: x, y: y};
     },
     fireTrack: function(inType, inEvent, inTrackingData) {
       var t = inTrackingData;
       var d = this.calcPositionDelta(t.downEvent, inEvent);
       var dd = this.calcPositionDelta(t.lastMoveEvent, inEvent);
       if (dd.x) {
         t.xDirection = this.clampDir(dd.x);
       } else if (inType === 'trackx') {
         return;
       }
       if (dd.y) {
         t.yDirection = this.clampDir(dd.y);
       } else if (inType === 'tracky') {
         return;
       }
       var gestureProto = {
         bubbles: true,
         cancelable: true,
         trackInfo: t.trackInfo,
         relatedTarget: inEvent.relatedTarget,
         pointerType: inEvent.pointerType,
         pointerId: inEvent.pointerId,
         _source: 'track'
       };
       if (inType !== 'tracky') {
         gestureProto.x = inEvent.x;
         gestureProto.dx = d.x;
         gestureProto.ddx = dd.x;
         gestureProto.clientX = inEvent.clientX;
         gestureProto.pageX = inEvent.pageX;
         gestureProto.screenX = inEvent.screenX;
         gestureProto.xDirection = t.xDirection;
       }
       if (inType !== 'trackx') {
         gestureProto.dy = d.y;
         gestureProto.ddy = dd.y;
         gestureProto.y = inEvent.y;
         gestureProto.clientY = inEvent.clientY;
         gestureProto.pageY = inEvent.pageY;
         gestureProto.screenY = inEvent.screenY;
         gestureProto.yDirection = t.yDirection;
       }
       var e = eventFactory.makeGestureEvent(inType, gestureProto);
       t.downTarget.dispatchEvent(e);
     },
     down: function(inEvent) {
       if (inEvent.isPrimary && (inEvent.pointerType === 'mouse' ? inEvent.buttons === 1 : true)) {
         var p = {
           downEvent: inEvent,
           downTarget: inEvent.target,
           trackInfo: {},
           lastMoveEvent: null,
           xDirection: 0,
           yDirection: 0,
           tracking: false
         };
         pointermap.set(inEvent.pointerId, p);
       }
     },
     move: function(inEvent) {
       var p = pointermap.get(inEvent.pointerId);
       if (p) {
         if (!p.tracking) {
           var d = this.calcPositionDelta(p.downEvent, inEvent);
           var move = d.x * d.x + d.y * d.y;
           // start tracking only if finger moves more than WIGGLE_THRESHOLD
           if (move > this.WIGGLE_THRESHOLD) {
             p.tracking = true;
             p.lastMoveEvent = p.downEvent;
             this.fireTrack('trackstart', inEvent, p);
           }
         }
         if (p.tracking) {
           this.fireTrack('track', inEvent, p);
           this.fireTrack('trackx', inEvent, p);
           this.fireTrack('tracky', inEvent, p);
         }
         p.lastMoveEvent = inEvent;
       }
     },
     up: function(inEvent) {
       var p = pointermap.get(inEvent.pointerId);
       if (p) {
         if (p.tracking) {
           this.fireTrack('trackend', inEvent, p);
         }
         pointermap.delete(inEvent.pointerId);
       }
     }
   };
   dispatcher.registerGesture('track', track);
 })(window.PolymerGestures);

/**
 * This event is fired when a pointer is held down for 200ms.
 *
 * @module PointerGestures
 * @submodule Events
 * @class hold
 */
/**
 * Type of pointer that made the holding event.
 * @type String
 * @property pointerType
 */
/**
 * Screen X axis position of the held pointer
 * @type Number
 * @property clientX
 */
/**
 * Screen Y axis position of the held pointer
 * @type Number
 * @property clientY
 */
/**
 * Type of pointer that made the holding event.
 * @type String
 * @property pointerType
 */
/**
 * This event is fired every 200ms while a pointer is held down.
 *
 * @class holdpulse
 * @extends hold
 */
/**
 * Milliseconds pointer has been held down.
 * @type Number
 * @property holdTime
 */
/**
 * This event is fired when a held pointer is released or moved.
 *
 * @class release
 */

(function(scope) {
  var dispatcher = scope.dispatcher;
  var eventFactory = scope.eventFactory;
  var hold = {
    // wait at least HOLD_DELAY ms between hold and pulse events
    HOLD_DELAY: 200,
    // pointer can move WIGGLE_THRESHOLD pixels before not counting as a hold
    WIGGLE_THRESHOLD: 16,
    events: [
      'down',
      'move',
      'up',
    ],
    exposes: [
      'hold',
      'holdpulse',
      'release'
    ],
    heldPointer: null,
    holdJob: null,
    pulse: function() {
      var hold = Date.now() - this.heldPointer.timeStamp;
      var type = this.held ? 'holdpulse' : 'hold';
      this.fireHold(type, hold);
      this.held = true;
    },
    cancel: function() {
      clearInterval(this.holdJob);
      if (this.held) {
        this.fireHold('release');
      }
      this.held = false;
      this.heldPointer = null;
      this.target = null;
      this.holdJob = null;
    },
    down: function(inEvent) {
      if (inEvent.isPrimary && !this.heldPointer) {
        this.heldPointer = inEvent;
        this.target = inEvent.target;
        this.holdJob = setInterval(this.pulse.bind(this), this.HOLD_DELAY);
      }
    },
    up: function(inEvent) {
      if (this.heldPointer && this.heldPointer.pointerId === inEvent.pointerId) {
        this.cancel();
      }
    },
    move: function(inEvent) {
      if (this.heldPointer && this.heldPointer.pointerId === inEvent.pointerId) {
        var x = inEvent.clientX - this.heldPointer.clientX;
        var y = inEvent.clientY - this.heldPointer.clientY;
        if ((x * x + y * y) > this.WIGGLE_THRESHOLD) {
          this.cancel();
        }
      }
    },
    fireHold: function(inType, inHoldTime) {
      var p = {
        bubbles: true,
        cancelable: true,
        pointerType: this.heldPointer.pointerType,
        pointerId: this.heldPointer.pointerId,
        x: this.heldPointer.clientX,
        y: this.heldPointer.clientY,
        _source: 'hold'
      };
      if (inHoldTime) {
        p.holdTime = inHoldTime;
      }
      var e = eventFactory.makeGestureEvent(inType, p);
      this.target.dispatchEvent(e);
    }
  };
  dispatcher.registerGesture('hold', hold);
})(window.PolymerGestures);

/**
 * This event is fired when a pointer quickly goes down and up, and is used to
 * denote activation.
 *
 * Any gesture event can prevent the tap event from being created by calling
 * `event.preventTap`.
 *
 * Any pointer event can prevent the tap by setting the `tapPrevented` property
 * on itself.
 *
 * @module PointerGestures
 * @submodule Events
 * @class tap
 */
/**
 * X axis position of the tap.
 * @property x
 * @type Number
 */
/**
 * Y axis position of the tap.
 * @property y
 * @type Number
 */
/**
 * Type of the pointer that made the tap.
 * @property pointerType
 * @type String
 */
(function(scope) {
  var dispatcher = scope.dispatcher;
  var eventFactory = scope.eventFactory;
  var pointermap = new scope.PointerMap();
  var tap = {
    events: [
      'down',
      'up'
    ],
    exposes: [
      'tap'
    ],
    down: function(inEvent) {
      if (inEvent.isPrimary && !inEvent.tapPrevented) {
        pointermap.set(inEvent.pointerId, {
          target: inEvent.target,
          buttons: inEvent.buttons,
          x: inEvent.clientX,
          y: inEvent.clientY
        });
      }
    },
    shouldTap: function(e, downState) {
      if (e.pointerType === 'mouse') {
        // only allow left click to tap for mouse
        return downState.buttons === 1;
      }
      return !e.tapPrevented;
    },
    up: function(inEvent) {
      var start = pointermap.get(inEvent.pointerId);
      if (start && this.shouldTap(inEvent, start)) {
        // up.relatedTarget is target currently under finger
        var t = scope.targetFinding.LCA(start.target, inEvent.relatedTarget);
        if (t) {
          var e = eventFactory.makeGestureEvent('tap', {
            bubbles: true,
            cancelable: true,
            x: inEvent.clientX,
            y: inEvent.clientY,
            detail: inEvent.detail,
            pointerType: inEvent.pointerType,
            pointerId: inEvent.pointerId,
            altKey: inEvent.altKey,
            ctrlKey: inEvent.ctrlKey,
            metaKey: inEvent.metaKey,
            shiftKey: inEvent.shiftKey,
            _source: 'tap'
          });
          t.dispatchEvent(e);
        }
      }
      pointermap.delete(inEvent.pointerId);
    }
  };
  // patch eventFactory to remove id from tap's pointermap for preventTap calls
  eventFactory.preventTap = function(e) {
    return function() {
      e.tapPrevented = true;
      pointermap.delete(e.pointerId);
    };
  };
  dispatcher.registerGesture('tap', tap);
})(window.PolymerGestures);
