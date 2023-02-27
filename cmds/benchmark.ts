import { program } from 'commander';
import { AptosAccount, AptosClient, HexString, TxnBuilderTypes, BCS } from 'aptos';
import 'dotenv/config';
import fs from 'fs';

const {
  AccountAddress,
  TypeTagStruct,
  EntryFunction,
  StructTag,
  TransactionPayloadEntryFunction,
  RawTransaction,
  ChainId,
} = TxnBuilderTypes;

program
  .version('0.0.1')
  .description('Simple coin transfer benchmark test')
  // .argument('<amount>', 'amount to transfer')
  .requiredOption('-p, --private_key_file <keyfiles...>', 'private_key_file')
  .requiredOption('-r, --recipient <address...>', 'recipient')
  .requiredOption('-a, --amount <number>', 'amount')
  .option('-u, --aptos_node_url <url>', 'aptos_node_url', 'https://fullnode.testnet.aptoslabs.com')
  .option('-c, --coin_type <coin_type>', 'coin_type', '0x1::aptos_coin::AptosCoin')
  .option('-n, --txnum <number>', 'The number of transaction submitting', '10')
  .option('-w, --wait_done', 'wait_done', false)
  .option('-s, --summary <path>', 'summary')
  .parse(process.argv);

export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function main() {
  const options = program.opts();
  const { private_key_file, recipient, aptos_node_url, wait_done, summary, txnum, amount } = options;
  const senders = (private_key_file as string[]).map((prikeyfile) => {
    const prikey = fs.readFileSync(prikeyfile, 'utf8');
    return new AptosAccount(HexString.ensure(prikey).toUint8Array());
  });
  const receivers = recipient as string[];
  const results: any[] = [];
  let start = Number.MAX_VALUE;
  let end = 0;
  const txhashs: string[] = [];
  const waits = senders.map(async (sender, sendernum) => {
    const client = new AptosClient(aptos_node_url);
    let txnerrors = 0;
    let txnsent = 0;
    const receiver = HexString.ensure(receivers[sendernum]);
    const sender_addr = sender.address();
    const resource = await client.getAccount(sender_addr);
    let sequence_number = Number(resource.sequence_number);
    const stime = +new Date();
    const chainid = await client.getChainId();
    for (let i = 0; i < txnum; i++) {
      txnsent++;
      if (start > stime) start = stime;
      try {
        const _stime = +new Date();
        const recv_account_address = AccountAddress.fromHex(receiver);
        const ctype = new TypeTagStruct(StructTag.fromString('0x1::aptos_coin::AptosCoin'));
        // const entryFunctionPayload = new TransactionPayloadEntryFunction(
        //   EntryFunction.natural(
        //     '0x1::coin',
        //     'transfer',
        //     [ctype],
        //     [BCS.bcsToBytes(recv_account_address), BCS.bcsSerializeUint64(amount)]
        //   )
        // );
        const entryFunctionPayload = new TransactionPayloadEntryFunction(
          EntryFunction.natural(
            '0x1::aptos_account',
            'transfer',
            [],
            [BCS.bcsToBytes(recv_account_address), BCS.bcsSerializeUint64(amount)]
          )
        );
        const rawtxn = new RawTransaction(
          AccountAddress.fromHex(sender_addr),
          BigInt(sequence_number),
          entryFunctionPayload,
          BigInt(10000),
          BigInt(150),
          BigInt(Math.floor(Date.now() / 1000) + 10),
          new ChainId(chainid)
        );
        const bcstxn = AptosClient.generateBCSTransaction(sender, rawtxn);
        const txnr = await client.submitSignedBCSTransaction(bcstxn);
        sequence_number = sequence_number + 1;
        let txnhash: string;
        if (wait_done) {
          await client.waitForTransactionWithResult(txnr.hash)
          txnhash = txnr.hash;
        } else {
          txnhash = txnr.hash;
        }
        txhashs.push(txnhash);
        console.log(
          sender_addr.toString().substring(0, 8),
          sequence_number,
          (+new Date() - _stime) / 1000,
          txnhash
        );
      } catch (e) {
        txnerrors++;
        console.error(e);
      }
    }
    const etime = +new Date();
    if (end < etime) end = etime;
    const t = (etime - stime) / 1000;
    const result = {
      pid: process.pid,
      sender: sender_addr.toString().substring(0, 8),
      start: stime/1000,
      end: etime/1000,
      elapsed_avg: Number((t / txnum).toFixed(3)),
      elapsed_total: Number(t.toFixed(3)),
      txnsent,
      txnerrors,
      throughput: Number((txnsent / t).toFixed(3)),
    };
    results.push(result);
  });
  await Promise.all(waits);
  let elapsed_avg = 0;
  results.forEach((r) => {
    elapsed_avg = elapsed_avg + r.elapsed_avg;
  });
  elapsed_avg = elapsed_avg / results.length;
  console.table(results);
  if (summary) {
    let txnsent = 0;
    let txnerrors = 0;
    results.forEach((r) => {
      txnsent = txnsent + r.txnsent;
      txnerrors = txnerrors + r.txnerrors;
    });
    fs.appendFileSync(
      summary,
      JSON.stringify({
        pid: process.pid,
        series: results.length,
        start: start/1000,
        end: end/1000,
        elapsed_total: (end - start) / 1000,
        elapsed_avg: elapsed_avg.toFixed(3),
        txnsent,
        txnerrors,
        throughput: Number((txnsent / ((end - start) / 1000)).toFixed(3)),
      }) + '\n'
    );
  }
}

main();
