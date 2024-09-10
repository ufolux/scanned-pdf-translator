#!/bin/bash

# Build the project
echo "Building the project..."

blob_path=out/sea-prep.blob
bin_path=out/pdf-trans

pnpm build
node --experimental-sea-config sea-config.json
rm -f ${bin_path}
cp $(command -v node) ${bin_path}
codesign --remove-signature out/pdf-trans
chmod 777 ${bin_path}
pnpx postject ${bin_path} NODE_SEA_BLOB ${blob_path} \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
    --macho-segment-name NODE_SEA
chmod 555 ${bin_path}

