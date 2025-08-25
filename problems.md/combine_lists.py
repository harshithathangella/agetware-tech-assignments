def combine_lists(list1, list2):
    merged = sorted(list1 + list2, key=lambda x: x['positions'][0])
    result = []

    for item in merged:
        if not result:
            result.append(item)
            continue

        last = result[-1]
        l1, r1 = last['positions']
        l2, r2 = item['positions']

        overlap = max(0, min(r1, r2) - max(l1, l2))
        len2 = r2 - l2

        if overlap >= len2 / 2:
            last['values'].extend(item['values'])
        else:
            result.append(item)

    return result


def read_list(n):
    data = []
    for i in range(n):
        print(f"\nElement {i + 1}:")
        left = int(input("  Left position: "))
        right = int(input("  Right position: "))
        values = list(map(int, input("  Enter values (space-separated): ").split()))
        data.append({"positions": [left, right], "values": values})
    return data


def main():
    n1 = int(input("Enter number of elements in List 1: "))
    list1 = read_list(n1)

    n2 = int(input("\nEnter number of elements in List 2: "))
    list2 = read_list(n2)

    result = combine_lists(list1, list2)

    print("\nCombined List:")
    for item in result:
        print(item)


if __name__ == "__main__":
    main()
