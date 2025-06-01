chrome: $(wildcard extension/*)
	mkdir -p packages
	cd extension && zip -r ../packages/chrome_super_zen.zip .

firefox: $(wildcard extension/*)
	mkdir -p packages
	cd extension && zip -r ../packages/firefox_super_zen.zip .

all: chrome firefox

clean:
	rm -rf packages/*
