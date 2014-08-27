install:
	git clone git@github.com:Polymer/tools.git
	git clone git@github.com:Polymer/polymer-gestures.git
	cd polymer-gestures && npm install && grunt

build:
	cd polymer-gestures && grunt
	cp polymer-gestures/polymergestures.dev.js blocks.common/polymer-gestures/polymer-gestures.js

.PHONY: install
