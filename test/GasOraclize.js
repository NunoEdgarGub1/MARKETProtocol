const MarketContractOraclize = artifacts.require("TestableMarketContractOraclize");
const MarketCollateralPool = artifacts.require("MarketCollateralPool");
const MarketToken = artifacts.require("MarketToken");
const CollateralToken = artifacts.require("CollateralToken");
const OrderLib = artifacts.require("OrderLib");
const Helpers = require('./helpers/Helpers.js')

// test to ensure callback gas is within limits when settling contracts
contract('MarketContractOraclize.CallBackExpiration', function(accounts) {
    let orderLib;
    let tradeHelper;
    let collateralPool;
    let collateralToken;
    let marketToken;
    let marketContract;

    const accountMaker = accounts[0];

    before(async function() {
        collateralPool = await MarketCollateralPool.deployed();
        marketToken = await MarketToken.deployed();
        marketContract = await MarketContractOraclize.deployed();
        orderLib = await OrderLib.deployed();
        collateralToken = await CollateralToken.deployed();
        tradeHelper = await Helpers.TradeHelper(MarketContractOraclize, OrderLib, CollateralToken, MarketCollateralPool);
    })

    it("gas used by Oraclize callback is within specified limit", async function() {
        const marketContractExpirationInTenSeconds = Math.floor(Date.now() / 1000) + 10;
        const oraclizeQueryCallbackRepeat = 7; // callback will be fired once
        const priceFloor = 1;
        const priceCap = 1000000; // 10k USD
        let gasLimit = 6500000;  // gas limit for development network
        let block = web3.eth.getBlock("latest");
        if (block.gasLimit > 7000000) {  // coverage network
            gasLimit = block.gasLimit;
        }
        let txReceipt = null;  // Oraclize callback transaction receipt
        MarketContractOraclize.new(
            "ETHUSD-10",
            marketToken.address,
            collateralToken.address,
            [priceFloor, priceCap, 2, 1, marketContractExpirationInTenSeconds],
            "URL",
            "json(https://api.kraken.com/0/public/Ticker?pair=ETHUSD).result.XETHZUSD.c.0",
            oraclizeQueryCallbackRepeat,
            { gas: gasLimit, value: web3.toWei('.1', 'ether'), accountMaker}
        ).then(async function(deployedMarketContract) {

            let oraclizeCallbackGasCost = await deployedMarketContract.QUERY_CALLBACK_GAS.call();
            let contractSettledEvent = deployedMarketContract.ContractSettled();
            contractSettledEvent.watch(async (err, response) => {
                if (err) {
                    console.log(err);
                };

                contractSettledEvent.stopWatching();
                assert.equal(response.event, 'ContractSettled');
                txReceipt = await web3.eth.getTransactionReceipt(response.transactionHash);
                console.log("Oraclize callback gas used : " + txReceipt.gasUsed);
                assert.isBelow(txReceipt.gasUsed, oraclizeCallbackGasCost,
                               "Callback tx claims to have used more gas than allowed!");
                return response;
            });
        });

        let waitForOraclizeCallback = ms => new Promise((r, j) => {
            var check = () => {
              if (txReceipt)
                r()
              else if((ms -= 1000) < 0)
                j('Oraclize time out!')
              else
                setTimeout(check, 1000)
            }
            setTimeout(check, 1000)
        });

        await waitForOraclizeCallback(30000);

        assert.notEqual(txReceipt, null, "Oraclize callback did not arrive. Please increase QUERY_CALLBACK_GAS!");
    })
});

// test to ensure callback gas is within limits when scheduling recursive queries
contract('MarketContractOraclize.CallBack', function(accounts) {
  let orderLib;
  let tradeHelper;
  let collateralPool;
  let collateralToken;
  let marketToken;
  let marketContract;

  const accountMaker = accounts[0];

  before(async function() {
    collateralPool = await MarketCollateralPool.deployed();
    marketToken = await MarketToken.deployed();
    marketContract = await MarketContractOraclize.deployed();
    orderLib = await OrderLib.deployed();
    collateralToken = await CollateralToken.deployed();
    tradeHelper = await Helpers.TradeHelper(MarketContractOraclize, OrderLib, CollateralToken, MarketCollateralPool);
  })

  it("gas used by Oraclize callback is within specified limit", async function() {
    const marketContractExpirationInTenSeconds = Math.floor(Date.now() / 1000) + 10000;
    const oraclizeQueryCallbackRepeat = 7; // callback will be fired once
    const priceFloor = 1;
    const priceCap = 1000000; // 10k USD
    let gasLimit = 6500000;  // gas limit for development network
    let block = web3.eth.getBlock("latest");
    if (block.gasLimit > 7000000) {  // coverage network
      gasLimit = block.gasLimit;
    }
    let txReceipt = null;  // Oraclize callback transaction receipt
    MarketContractOraclize.new(
      "ETHUSD-10",
      marketToken.address,
      collateralToken.address,
      [priceFloor, priceCap, 2, 1, marketContractExpirationInTenSeconds],
      "URL",
      "json(https://api.kraken.com/0/public/Ticker?pair=ETHUSD).result.XETHZUSD.c.0",
      oraclizeQueryCallbackRepeat,
      { gas: gasLimit, value: web3.toWei('.1', 'ether'), accountMaker}
    ).then(async function(deployedMarketContract) {

      let oraclizeCallbackGasCost = await deployedMarketContract.QUERY_CALLBACK_GAS.call();
      let updatedLastPriceEvent = deployedMarketContract.UpdatedLastPrice();
      updatedLastPriceEvent.watch(async (err, response) => {
        if (err) {
          console.log(err);
        };

      updatedLastPriceEvent.stopWatching();
      assert.equal(response.event, 'UpdatedLastPrice');
      txReceipt = await web3.eth.getTransactionReceipt(response.transactionHash);
      console.log("Oraclize callback gas used : " + txReceipt.gasUsed);
      assert.isBelow(txReceipt.gasUsed, oraclizeCallbackGasCost,
        "Callback tx claims to have used more gas than allowed!");

      let isSettled = await deployedMarketContract.isSettled.call();
      assert.isFalse(isSettled, "Contract should not be in a settled state");

      return response;
    });
    });

    let waitForOraclizeCallback = ms => new Promise((r, j) => {
      var check = () => {
      if (txReceipt)
      r()
      else if((ms -= 1000) < 0)
    j('Oraclize time out!')
  else
    setTimeout(check, 1000)
  }
    setTimeout(check, 1000)
  });

    await waitForOraclizeCallback(30000);

    assert.notEqual(txReceipt, null, "Oraclize callback did not arrive. Please increase QUERY_CALLBACK_GAS!");
  })
});
