(function($, polymer) {
    var handler = (function() {
        return parseFloat($.fn.jquery) < 1.9 ? function() {
            $.event.handle.apply( this, arguments );
        } : function(e) {
            $.event.trigger.call(this, e, {}, this, true);
        }
    }());
    ['track', 'pinch', 'rotate'].forEach(function(event) {
        $.event.special[event] = {
            add: function() {
                polymer.addEventListener(this, event, handler);
            },
            remove: function() {
                polymer.removeEventListener(this, event, handler);
            }
        }
    });
}(jQuery, PolymerGestures));
