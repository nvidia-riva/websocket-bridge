#!/bin/bash

# SPDX-FileCopyrightText: Copyright (c) 2022 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: MIT

protoc --proto_path=. --js_out=import_style=commonjs,binary:. ./riva/proto/*.proto
