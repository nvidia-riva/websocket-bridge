#!/bin/bash
protoc --proto_path=. --js_out=import_style=commonjs,binary:. ./riva/proto/*.proto
