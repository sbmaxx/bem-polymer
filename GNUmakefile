UPSTREAM = https://github.com/Polymer/polymer-gestures.git
FORK = git@github.com:sbmaxx/polymer-gestures.git

WHAT ?= fork
BRANCH ?= master

ifeq ($(WHAT),upstream)
REPO = $(UPSTREAM)
else
REPO = $(FORK)
BRANCH = integration
endif

install:
	-git clone git@github.com:Polymer/tools.git
	-git clone $(REPO)
	cd polymer-gestures && git checkout $(BRANCH)
	cd polymer-gestures && npm install
	cd polymer-gestures && grunt

build:
	cd polymer-gestures && grunt
	cp polymer-gestures/polymergestures.dev.js blocks.common/polymer-gestures/polymer-gestures.js

clean:
	rm -rf polymer-gestures
	rm -rf tools

server:
	python -m SimpleHTTPServer

.PHONY: install
