import express from 'express';
export const app = express();

app.use(express.urlencoded({
    extended: true
}));
app.use(express.json());

app.get('/', (req: any, res: any) => {
    res.json('Welcome to the Trading App Backend Algorithm!');
});

app.listen(3000, () => {
    return console.log(`Server is listening at http://localhost:3000`);
});

interface Balances {
    [key: string]: number;
}

interface User {
    id: string;
    balances: Balances;
};

interface Order {
    userId: string;
    price: number;
    quantity: number;
}

export const TICKER = "GOOGLE";

const users: User[] = [{
    id: "1",
    balances: {
        "GOOGLE": 10,
        "USD": 50000
    }
}, {
    id: "2",
    balances: {
        "GOOGLE": 10,
        "USD": 50000
    }
}];

const bids: Order[] = [];
const asks: Order[] = [];

// Place a limit order
app.post("/order", (req: any, res: any) => {
    const side: string = req.body.side;
    const price: number = req.body.price;
    const quantity: number = req.body.quantity;
    const userId: string = req.body.userId;

    const remainingQty = fillOrders(side, price, quantity, userId);

    if (remainingQty === 0) {
        res.json({ filledQuantity: quantity });
        return;
    }

    if (side === "bid") {
        bids.push({
            userId,
            price,
            quantity: remainingQty
        });
        bids.sort((a, b) => a.price < b.price ? -1 : 1);
    } else {
        asks.push({
            userId,
            price,
            quantity: remainingQty
        })
        asks.sort((a, b) => a.price < b.price ? 1 : -1);
    }

    res.json({
        filledQuantity: quantity - remainingQty,
    })
})

app.get("/depth", (req: any, res: any) => {
    const depth: {
        [price: string]: {
            type: "bid" | "ask",
            quantity: number,
        }
    } = {};

    for (let i = 0; i < bids.length; i++) {
        if (!depth[bids[i].price]) {
            depth[bids[i].price] = {
                quantity: bids[i].quantity,
                type: "bid"
            };
        } else {
            depth[bids[i].price].quantity += bids[i].quantity;
        }
    }

    for (let i = 0; i < asks.length; i++) {
        if (!depth[asks[i].price]) {
            depth[asks[i].price] = {
                quantity: asks[i].quantity,
                type: "ask"
            }
        } else {
            depth[asks[i].price].quantity += asks[i].quantity;
        }
    }

    res.json({
        depth
    })
})

app.get("/balance/:userId", (req, res) => {
    const userId = req.params.userId;
    const user = users.find(x => x.id === userId);
    if (!user) {
        return res.json({
            USD: 0,
            [TICKER]: 0
        })
    }
    res.json({ balances: user.balances });
})

app.get("/quote", (req: any, res: any) => {
    const { side, quantity } = req.body;
    let totalCost = 0;
    let remainingQuantity = quantity;

    if (side === 'bid') {
        const sortedAsks = asks.slice().sort((a, b) => a.price - b.price);

        for (let order of sortedAsks) {
            if (remainingQuantity <= 0) break;
            const tradeQuantity = Math.min(order.quantity, remainingQuantity);
            totalCost += tradeQuantity * order.price;
            remainingQuantity -= tradeQuantity;
        }
    } else if (side === 'ask') {
        const sortedBids = bids.slice().sort((a, b) => b.price - a.price);

        for (let order of sortedBids) {
            if (remainingQuantity <= 0) break;
            const tradeQuantity = Math.min(order.quantity, remainingQuantity);
            totalCost += tradeQuantity * order.price;
            remainingQuantity -= tradeQuantity;
        }
    }

    if (remainingQuantity > 0) {
        return res.status(400).json({ error: 'Not enough liquidity' });
    }

    res.json({ quote: totalCost });

    // Another way of doing it
    // if (asks.length === 0 || bids.length === 0) {
    //     res.json({ message: "No quotes available" });
    //     return;
    // }

    // const lowestAsk = Math.min(...asks.map(ask => ask.price));
    // const highestBid = Math.max(...bids.map(bid => bid.price));

    // const randomQuote = Math.random() * (lowestAsk - highestBid) + highestBid;

    // res.json({ quote: randomQuote.toFixed(2) });
});

function flipBalance(userId1: string, userId2: string, quantity: number, price: number) {
    let user1 = users.find(x => x.id === userId1);
    let user2 = users.find(x => x.id === userId2);
    if (!user1 || !user2) {
        return;
    }
    user1.balances[TICKER] -= quantity;
    user2.balances[TICKER] += quantity;
    user1.balances["USD"] += (quantity * price);
    user2.balances["USD"] -= (quantity * price);
}

function fillOrders(side: string, price: number, quantity: number, userId: string): number {
    let remainingQuantity = quantity;
    if (side === "bid") {
        for (let i = asks.length - 1; i >= 0; i--) {
            if (asks[i].price > price) {
                continue;
            }
            if (asks[i].quantity > remainingQuantity) {
                asks[i].quantity -= remainingQuantity;
                flipBalance(asks[i].userId, userId, remainingQuantity, asks[i].price);
                return 0;
            } else {
                remainingQuantity -= asks[i].quantity;
                flipBalance(asks[i].userId, userId, asks[i].quantity, asks[i].price);
                asks.pop();
            }
        }
    } else {
        for (let i = bids.length - 1; i >= 0; i--) {
            if (bids[i].price < price) {
                continue;
            }
            if (bids[i].quantity > remainingQuantity) {
                bids[i].quantity -= remainingQuantity;
                flipBalance(userId, bids[i].userId, remainingQuantity, price);
                return 0;
            } else {
                remainingQuantity -= bids[i].quantity;
                flipBalance(userId, bids[i].userId, bids[i].quantity, price);
                bids.pop();
            }
        }
    }

    return remainingQuantity;
}