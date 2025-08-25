def minimize_loss(prices):
    price_index = [(p, i) for i, p in enumerate(prices)]
    price_index.sort(reverse=True)

    min_loss = float('inf')
    buy_year = sell_year = -1

    for i in range(len(price_index)):
        for j in range(i + 1, len(price_index)):
            p1, y1 = price_index[i]
            p2, y2 = price_index[j]

            if y1 < y2 and p1 > p2:
                loss = p1 - p2
                if loss < min_loss:
                    min_loss = loss
                    buy_year, sell_year = y1, y2

    return buy_year + 1, sell_year + 1, min_loss

def main():
    prices = list(map(int, input("Enter prices (space-separated): ").split()))
    buy, sell, loss = minimize_loss(prices)
    print(f"Buy in year {buy}, sell in year {sell}, minimum loss: {loss}")

if __name__ == "__main__":
    main()
