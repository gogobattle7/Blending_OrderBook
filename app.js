const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const bodyParser = require("body-parser");
const path = require("path");
const mysql = require("mysql2");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 미들웨어 설정
app.use(bodyParser.json());

// 메모리에 구매 및 판매 주문 저장을 위한 배열
const buyOrders = [];
const sellOrders = [];
const dbConfig = {
  host: "localhost", // 데이터베이스 호스트
  user: "root", // 데이터베이스 사용자 이름
  password: "1234", // 데이터베이스 비밀번호
  database: "orderbook", // 데이터베이스 이름
};
const connection = mysql.createConnection(dbConfig);
connection.connect((err) => {
  if (err) {
    console.error("MySQL 연결 실패:", err);
  } else {
    console.log("MySQL에 성공적으로 연결되었습니다.");
  }
});

// 코인별 체결된 거래 목록을 저장할 객체
const completedTransactions = {};
// 코인 이름 목록을 저장하는 배열
let coins = ["비트코인", "이더리움", "리플", "도지코인"];

// /api/coins 엔드포인트 정의
app
  .route("/api/coins")
  // GET 요청: 코인 이름 목록을 JSON 형식으로 반환
  .get((req, res) => {
    res.json(coins);
  })
  // POST 요청: 새로운 코인 이름을 추가하고 성공 메시지를 반환
  .post((req, res) => {
    const { name } = req.body;

    // 새 코인 이름을 배열에 추가
    if (name && !coins.includes(name)) {
      coins.push(name);
      res
        .status(201)
        .json({ message: "코인 이름이 성공적으로 추가되었습니다." });
    } else {
      res.status(400).json({
        message: "잘못된 코인 이름 또는 이미 존재하는 코인 이름입니다.",
      });
    }
  });
// 웹 소켓을 통해 오더북 정보를 전달
const updateOrderBook = (ws) => {
  ws.send(JSON.stringify({ buyOrders, sellOrders }));
};

// 웹 소켓 연결 처리
wss.on("connection", (ws) => {
  console.log("클라이언트 연결됨");
  updateOrderBook(ws);
});

// 모든 클라이언트에게 오더북 업데이트 알림
const notifyClients = () => {
  const orderBookData = JSON.stringify({ buyOrders, sellOrders });
  const transactionData = JSON.stringify({ completedTransactions });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(orderBookData);
      client.send(transactionData);
    }
  });
};

// 체결된 거래를 buyerId 및 sellerId에 따라 수행하는 matchOrders 함수
const matchOrders = () => {
  console.log("matchOrders 입장");
  for (let buyIndex = 0; buyIndex < buyOrders.length; buyIndex++) {
    for (let sellIndex = 0; sellIndex < sellOrders.length; sellIndex++) {
      const buyOrder = buyOrders[buyIndex];
      const sellOrder = sellOrders[sellIndex];

      if (
        buyOrder.name === sellOrder.name &&
        buyOrder.price == sellOrder.price
      ) {
        // 체결된 거래 정보 생성
        const transaction = {
          coin: buyOrder.name,
          price: sellOrder.price,
          quantity: Math.min(buyOrder.quantity, sellOrder.quantity),
          buyerId: buyOrder.buyerId, // 구매자의 ID
          sellerId: sellOrder.sellerId, // 판매자의 ID
        };

        // MySQL에 체결된 거래를 저장하는 쿼리
        const query =
          "INSERT INTO trades (coin, price, quantity, buyer_id, seller_id) VALUES (?, ?, ?, ?, ?)";
        //   "INSERT INTO trades (buyer_id,seller_id,price,quantity,coin) VALUES (?,?,?,?,?)";
        connection.query(
          query,
          [
            transaction.coin,
            transaction.price,
            transaction.quantity,
            transaction.buyerId,
            transaction.sellerId,
          ],
          (err, results) => {
            if (err) {
              console.error("체결된 거래 저장 실패:", err);
            } else {
              console.log("체결된 거래 저장 성공:", results);
            }
          }
        );

        // 체결된 거래 목록에 추가
        if (!completedTransactions[buyOrder.name]) {
          completedTransactions[buyOrder.name] = [];
        }
        completedTransactions[buyOrder.name].push(transaction);

        // 구매 및 판매 주문 수량 업데이트
        buyOrder.quantity -= transaction.quantity;
        sellOrder.quantity -= transaction.quantity;

        // 주문이 완료되면 주문 목록에서 제거
        if (buyOrder.quantity === 0) {
          buyOrders.splice(buyIndex, 1);
          buyIndex--; // 배열 변경으로 인한 인덱스 조정
        }
        if (sellOrder.quantity === 0) {
          sellOrders.splice(sellIndex, 1);
          sellIndex--; // 배열 변경으로 인한 인덱스 조정
        }

        // 클라이언트에게 체결된 거래 정보 전달
        notifyClients();
      }
    }
  }
};

// 구매 주문을 추가하는 라우트
app.post("/api/buy", (req, res) => {
  const { name, price, quantity, buyerId } = req.body; // buyerId 포함

  // 요청된 코인이 coins 배열에 존재하는지 확인
  if (!coins.includes(name)) {
    // 코인이 존재하지 않으면, coins 배열에 추가
    coins.push(name);
    console.log(`코인 ${name}이(가) 추가되었습니다.`);
  }
  const query =
    'INSERT INTO orders (name, price, quantity, user_id, type) VALUES (?, ?, ?, ?, "buy")';
  // 구매 주문을 메모리에 추가 (buyerId 포함)
  const newOrder = { name, price, quantity, buyerId };
  connection.query(query, [name, price, quantity, buyerId], (err, results) => {
    if (err) {
      console.error("구매 주문 추가 실패:", err);
      return res.status(500).json({ message: "구매 주문 추가 실패" });
    }
    buyOrders.push(newOrder);
    // 주문이 추가되었음을 클라이언트에게 알림
    notifyClients();

    // 주문을 추가한 후 거래 체결 함수 호출
    matchOrders();

    // 응답 반환: 결과 ID를 반환합니다.
    res
      .status(201)
      .json({ id: results.insertId, name, price, quantity, buyerId });
  });
});

// 판매 주문을 추가하는 라우트
app.post("/api/sell", (req, res) => {
  const { name, price, quantity, sellerId } = req.body; // sellerId 포함
  const query =
    'INSERT INTO orders (name, price, quantity, user_id, type) VALUES (?, ?, ?, ?, "sell")';
  // 판매 주문을 메모리에 추가 (sellerId 포함)
  const newOrder = { name, price, quantity, sellerId };
  connection.query(query, [name, price, quantity, sellerId], (err, results) => {
    if (err) {
      console.error("판매 주문 추가 실패:", err);
      return res.status(500).json({ message: "판매 주문 추가 실패" });
    }
    sellOrders.push(newOrder);
    // 판매 주문이 추가되었음을 클라이언트에게 알림
    notifyClients();
    // 주문을 추가한 후 거래 체결 함수 호출
    matchOrders();

    // 응답 반환
    res.status(201).json(results.insertId);
  });
});

// 기본 경로 설정 (index.html 제공)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "static", "index.html"));
});

// 판매 매물 등록 페이지 경로 설정
app.get("/sell", (req, res) => {
  res.sendFile(path.join(__dirname, "static", "sell.html"));
});

// 구매 매물 등록 페이지 경로 설정
app.get("/buy", (req, res) => {
  res.sendFile(path.join(__dirname, "static", "buy.html"));
});

app.get("/order_book", (req, res) => {
  res.sendFile(path.join(__dirname, "static", "order_book.html"));
});
// 코인별 오더북 정보를 반환하는 라우트
app.get("/api/order_book", (req, res) => {
  const coinName = req.query.coin; // 요청된 코인의 이름을 URL 쿼리 파라미터에서 가져옴

  // 구매 주문 목록에서 요청된 코인에 해당하는 주문을 필터링
  const filteredBuyOrders = buyOrders.filter(
    (order) => order.name === coinName
  );
  // 판매 주문 목록에서 요청된 코인에 해당하는 주문을 필터링
  const filteredSellOrders = sellOrders.filter(
    (order) => order.name === coinName
  );

  // 구매 및 판매 주문 정보를 JSON 형식으로 반환
  res.json({
    buyOrders: filteredBuyOrders,
    sellOrders: filteredSellOrders,
  });
});

// 체결된 거래 목록을 반환하는 라우트
app.get("/api/matched_trades", (req, res) => {
  const coinName = req.query.coin; // 요청된 코인의 이름을 URL 쿼리 파라미터에서 가져옴

  // 요청된 코인 이름에 해당하는 체결된 거래 목록을 필터링
  const filteredTrades = completedTransactions[coinName] || [];

  // 체결된 거래 목록을 JSON 형식으로 반환
  res.json(filteredTrades);
});

// 서버 실행
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});
