#/bin/sh
echo `pwd`

env=$1

pnpm install

echo "build crypto-lib"
cd ./packages/crypto-lib  && pnpm install && pnpm run build && npm link && cd -

echo "build coin-base"
cd ./packages/coin-base && pnpm install && pnpm run build && npm link && cd -

echo "build type"
cd ./packages/web3jskit-type && pnpm install && pnpm run build && npm link && cd -

echo "build coin-ethereum"
cd ./packages/coin-ethereum && pnpm install && pnpm run build && npm link && cd -

echo "build coin-put"
cd ./packages/coin-put && pnpm install && pnpm run build && npm link && cd -

echo "build coin-solana"
cd ./packages/coin-solana && pnpm install && pnpm run build && npm link && cd -

echo "build coin-ton"
cd ./packages/coin-ton && pnpm install && pnpm run build && npm link && cd -

echo "build coin-tron"
cd ./packages/coin-tron && pnpm install && pnpm run build && npm link && cd -

echo "build jsweb3-sdk"
cd ./packages/jsweb3-sdk && pnpm install && pnpm run build && npm link && cd -

echo "build dapp"
cd ./packages/jsweb3-dapp && pnpm install && pnpm run build:$env && npm link && cd -

# string="coin-ethereum"
# array=($(echo $string | tr ',' ' '))
# for var in ${array[@]}; do
#   echo "build $var"
#   cd ./packages/$var && npm link @web3jskit/coin-base @web3jskit/crypto-lib && npm run build && cd -
#   echo "build " $var "success.\n\n"
# done

