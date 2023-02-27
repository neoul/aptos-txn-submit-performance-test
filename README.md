# Transaction submit test for Aptos fullnode

 

```bash
# Initialize the test accounts
# `DEFAULT_PROFILE_PRIVATE_KEY` must have aptos coin amount enough to fund to the test accounts.
./start.sh DEFAULT_PROFILE_PRIVATE_KEY

# Run start.sh without `DEFAULT_PROFILE_PRIVATE_KEY` after the test accounts are initialized.
./start.sh
```

## Configuration

```bash
#!/bin/bash

# Fullnode URL
APTOS_NODE_URL=https://aptos-testnet.nodeinfra.com/fullnode/v1

# Target cluster
NETWORK=testnet

# The number of Processes used for the test
PROCESSES=3

# The number of keypair (thread) per process used for the test
KEY_PER_PROCESS=2

# The number of transactions submitted
TXN_NUM=50

# Waiting for the transaction confirmation on the test.
# WAIT_DONE='-w'

## A-->B: 1~10 --> 11~20
## B-->A: 11~20 --> 1~10
## CHAINING: 1-->2, 2-->3, .. 10-->1
# MODE=ATOB
# MODE=BTOA
MODE=CHAINING

```

## output

- `.key/`: Keypairs used in test
- `.aptos/config.yaml`: Aptos profiles
- `output`: The result of the test
