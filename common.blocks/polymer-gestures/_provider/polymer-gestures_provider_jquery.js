(function($, polymer) {
    $.event.fixHooks.track = {
        // дополнительные свойства, которые необходимо прокинуть в jquery event
        // остальные всегда доступны из event.originalEvent.*
        props: [ 'ddx', 'ddy' ]
    };
    ['track', 'pinch', 'rotate', 'trackend', 'pinchstart', 'pinchend'].forEach(function(event) {
        $.event.special[event] = {
            add: function() {
                // нет нужды вызывать какой-либоу callback здесь
                // т.к. внутри полимера происходит this.dispatchEvent
                // и это событие обрабатывается jQuery
                polymer.addEventListener(this, event, $.noop);
            },
            remove: function() {
                polymer.removeEventListener(this, event, $.noop);
            }
        }
    });
}(jQuery, PolymerGestures));
