#!/bin/bash

APTOS_CONFIG_YAML=.aptos/config.yaml

APTOS_NODE_URL=https://aptos-testnet.nodeinfra.com/fullnode/v1
NETWORK=testnet
PROCESSES=3
KEY_PER_PROCESS=2
TXN_NUM=50

ALL_KEYS=$(("$PROCESSES"*"$KEY_PER_PROCESS"*2))
OUTPUT=P${PROCESSES}_K${KEY_PER_PROCESS}_N${TXN_NUM}_$(date -Iseconds)
SUMMARY=output/$OUTPUT.summary
# WAIT_DONE='-w'

function address() {
   yq ".profiles.$1.account" "$APTOS_CONFIG_YAML"
}

function keypair() {
   if [ ! -f ".key/$1" ]; then
      mkdir -p .key
      aptos key generate --output-file ".key/$1" >> /dev/null 2>&1
      chmod go-wrx .key
   fi
   if ! grep -Fq "$1:" "$APTOS_CONFIG_YAML" > /dev/null 2>&1; then
      aptos init --assume-yes --network "$NETWORK" --profile "$1" --private-key-file ".key/$1" --skip-faucet >> /dev/null 2>&1
      sleep 1
   fi
   if [ -n "$2" ]; then
      echo "$1" "$(address $1)" fund=$(aptos account transfer --assume-yes --profile default --account "$1" --amount 100000000 | jq .Result.transaction_hash)
   else
      echo "$1" "$(address $1)"
   fi
}

function benchmark() {
   _START=$(($1 + 1))
   _END=$(("$_START"+"$KEY_PER_PROCESS" -1))
   KEYS=''; RECIPIENTS='';
   for i in $(seq "$_START" 1 "$_END"); do
      KEYS="$KEYS .key/user${i}"
      RECIPIENTS="$RECIPIENTS $(address user$(($i*2)))"
   done
   # echo $_START, $KEYS, $RECIPIENTS
   node dist/benchmark.js -p ${KEYS} -r ${RECIPIENTS} -a 1 -n "$TXN_NUM" $WAIT_DONE -u "$APTOS_NODE_URL" -s "$SUMMARY"
}

function install_benchmark() {
   yarn
   if ! command -v aptos &> /dev/null ; then
      wget -q https://github.com/aptos-labs/aptos-core/releases/download/aptos-cli-v1.0.5/aptos-cli-1.0.5-Ubuntu-x86_64.zip -O /tmp/tmp.zip && \
         sudo unzip /tmp/tmp.zip -d /usr/local/bin && rm /tmp/tmp.zip
   fi
   if ! command -v jq &> /dev/null; then
      echo "jq command doesn't exist... install jq "
      sudo apt install -y jq
   fi
   if ! command -v yq &> /dev/null; then
      echo "yq command doesn't exist... install yq "
      wget https://github.com/mikefarah/yq/releases/download/v4.30.8/yq_linux_amd64.tar.gz -O /tmp/yq_linux_amd64.tar.gz && \
         tar xvfz /tmp/yq_linux_amd64.tar.gz --directory /tmp && sudo mv /tmp/yq_linux_amd64 /usr/bin/yq
   fi
}

function initialize_benchmark() {
   if [ ! -f $APTOS_CONFIG_YAML ]; then
      aptos init --assume-yes --network "$NETWORK" --private-key "$1" >> /dev/null
   fi
   for ((i=1; i <= "$ALL_KEYS"; i++)); do
      keypair "user$i" $1
   done
}

function start_benchmark() {
   # for ((i=1; i <= "$PROCESSES"; i++)); do
   #    benchmark "$i"
   # done
   mkdir -p output
   for i in $(seq 0 "$KEY_PER_PROCESS" $(("$PROCESSES" * "$KEY_PER_PROCESS" - 1))); do
      sleep 0.1
      benchmark "${i}" &
      pids["${i}"]=$!
      # benchmark "${i}"
   done
   echo ... wait to complete ...
   for pid in ${pids[*]}; do
      wait "$pid"
   done
   echo ... complete ...
}

if [ -z "$1" ]; then
   if ! yq ".profiles.default.account" "$APTOS_CONFIG_YAML" >> /dev/null 2>&1 ; then
      echo "ERR:INVALID_USAGE: $0 ${FUNCNAME[0]} PRIVATE_KEY_OF_DEFAULT_PROFILE"
      exit 1
   fi
else
   if yq ".profiles.default.account" "$APTOS_CONFIG_YAML" >> /dev/null 2>&1; then
      BALANCE=$(aptos account list --query balance --url "$APTOS_NODE_URL" --account $(address default) \
         | jq .Result[0].coin.value | tr -d '"')
      BALANCE_TO_NEED=$(("$ALL_KEYS" * 100000000))
      if [[ $BALANCE -le $BALANCE_TO_NEED ]]; then
         echo "ERR:NOT_ENOUGH_BALANCE_IN_DEFAULT_PROFILE"
         exit 1
      fi
   fi
   
fi

DEFAULT_PROFILE_PRIVATEKEY=$1
install_benchmark
initialize_benchmark "$DEFAULT_PROFILE_PRIVATEKEY"
start_benchmark