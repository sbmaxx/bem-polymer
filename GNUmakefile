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
	-git clone git@github.com:Polymer/tools.git libs/tools
	-git clone $(REPO) libs/polymer-gestures
	cd libs/polymer-gestures && git checkout $(BRANCH)
	cd libs/polymer-gestures && npm install
	cd libs/polymer-gestures && grunt

update:: clean

update:: install
	@echo "done"

build:
	cd libs/polymer-gestures && grunt
	cp libs/polymer-gestures/polymergestures.dev.js common.blocks/polymer-gestures/polymer-gestures.js

clean:
	rm -rf libs

server:
	@echo open http://localhost:8000/polymer-gestures/samples/simple/index.html
	python -m SimpleHTTPServer

.PHONY: install build clean server update
