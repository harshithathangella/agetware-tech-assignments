def indian_currency_format(number):
    
    str_num = f"{number:.10f}".rstrip('0').rstrip('.')
    integer_part, dot, decimal_part = str_num.partition('.')

    if len(integer_part) <= 3:
        return integer_part + ('.' + decimal_part if decimal_part else '')

    last_three = integer_part[-3:]
    remaining = integer_part[:-3]
    groups = []

    while len(remaining) > 2:
        groups.insert(0, remaining[-2:])
        remaining = remaining[:-2]

    if remaining:
        groups.insert(0, remaining)

    formatted = ','.join(groups) + ',' + last_three
    return formatted + ('.' + decimal_part if decimal_part else '')


def main():
    number = float(input("Enter a number: "))
    formatted = indian_currency_format(number)
    print(f"Indian Currency Format: {formatted}")


if __name__ == "__main__":
    main()
