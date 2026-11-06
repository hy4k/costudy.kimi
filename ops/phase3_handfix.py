#!/usr/bin/env python3
"""Hand assignments for the final 127 unclassifiable blank-topic rows.
Assignments made by reading each question's content (see ids and rationale
in the workspace transcript). Emits phase3_handfix.sql."""
import json

# id -> section
A = """02ff827e-89cb-4d87-90b4-bdd1f6deca12""".split()  # placeholder, replaced below

ASSIGN = {
# --- Section A: financial reporting / securities / international finance ---
"181e3df5-546a-4e7f-8909-4f87eb9a2319": "Section A",  # interest-rate parity theorem
"24cfbe3d-1fc8-44fe-b056-b5b2b0c062f4": "Section A",  # apartment construction completion
"24d377f5-ac17-4731-a947-9091cc2dba78": "Section A",  # beta 1.0
"26882d43-2de9-4344-a385-13259cb24d38": "Section A",  # riskiest intl payment form
"2bbcf333-a02b-4656-af46-4ac0430301d1": "Section A",  # strong-form EMH
"3525bdcd-bd31-4636-8fee-87add5f27342": "Section A",  # days to collect AR
"462af4d7-75dd-414e-995f-647796c6e2ed": "Section A",  # weak-form EMH
"4be792a8-5fe9-4e6f-aadb-922388ae2c22": "Section A",  # state of economy, expected returns
"4cfb899b-83c4-4d61-95e4-82d2400b8575": "Section A",  # long-term debt-paying ability
"4d4faa39-4f57-4381-8551-b9367744ad78": "Section A",  # days' sales in receivables
"55e660c0-dc7a-41f1-9426-cb76c717b3df": "Section A",  # CAPM market portfolio
"57c14612-8052-4cd7-847c-37c45eb61dfd": "Section A",  # analyst comparing companies
"6899f016-70fc-490a-a799-6ffb6c224c6d": "Section A",  # pound exchange rate calc
"73d40bd2-5e1d-4a9e-a79a-7af8ec9be6a1": "Section A",  # inflation/euro depreciation
"7e1c2824-1147-492a-8681-0a2e8f682e92": "Section A",  # systematic risk, beta
"8521c249-a891-42ee-b30b-d99d621c849c": "Section A",  # gold in intl monetary system
"92e9a901-b00f-4800-a15e-eb41e182e4dc": "Section A",  # collection of AR effect
"93d71d6d-fda1-4a09-888e-6030bd0e9ab1": "Section A",  # dollar depreciation trade
"9c737e83-2ee4-4073-8f87-b082cebfd2e4": "Section A",  # portfolio diversification
"9ca2a320-31a1-4cfb-9009-44b2166eb074": "Section A",  # CAPM beta 0.50
"9dc650b7-56df-45f7-bad2-6c463f296677": "Section A",  # days' sales in receivables
"9dd8bb2f-4fbc-4bba-b064-a03f271558fe": "Section A",  # multinational benefit
"a40c53cc-6d9b-4d02-ae7a-0ac4b895782d": "Section A",  # liquidity risk
"a6886974-25e5-4593-8298-286904e0acc4": "Section A",  # forfaiting intl trade
"ac0a8e26-9c01-4aae-bea6-edd9c6e56807": "Section A",  # rate-of-return/time curve
"ace42dfb-1b50-4148-8a65-93b07a343f6b": "Section A",  # risk premium
"b3f572b6-7a14-44b7-9756-4098c5e2d585": "Section A",  # debt-to-total-equity
"be5ed194-f769-4d22-857d-c02bda51fe36": "Section A",  # consignment sale
"c9897ba1-9437-47f9-b1db-ed2dacbe4e48": "Section A",  # allowance for credit losses
"ccbe4fb6-f874-4098-922b-83c608bd48fe": "Section A",  # indenture covenant
"d22752cd-f2da-4d94-b8c7-cfe0cbe98240": "Section A",  # sales-to-working-capital ratio
"d8557e44-3bb5-42ea-b9f6-be400dfc1c54": "Section A",  # liabilities-to-equity ratio
"e002df54-8fba-4ed6-b98a-ef82c1d9ace0": "Section A",  # prior-period adjustments
"e06bdb8d-1119-4bd9-9ab6-417376cd1226": "Section A",  # IPO underwriting
"ed890f92-1d78-4faa-a19d-c83e0ca225bb": "Section A",  # CAPM beta 2.0
"eecbd779-c634-4f15-9fd0-ff195b9ffbc7": "Section A",  # acid-test ratio
"f08a229f-c05a-4079-a7a5-531473387e2f": "Section A",  # lease
"f49c20ae-6bd6-4dd0-99f3-1d3b9c0129ae": "Section A",  # equity vs debt financing cost
"f6bd1742-9d79-4ad1-894f-411fd50346b8": "Section A",  # dollar decline vs partners
"f872affc-509a-43cc-8135-296b1640de83": "Section A",  # semi-strong efficiency
"fe95f33c-dca7-4b92-9fe9-669c1f393fd6": "Section A",  # business revenue/tax
"22a78779-f688-4c9e-a9ad-eca0cb2b7fbe": "Section A",  # aging of receivables
# --- Section B: budgeting / capital budgeting / economics / working capital ---
"02ff827e-89cb-4d87-90b4-bdd1f6deca12": "Section B",  # T-bill pricing
"099a2de4-85de-47dc-915d-6013b0ce7b37": "Section B",  # EOQ with lead time
"0c90c76c-52ae-4c86-b43d-907fd7a9f241": "Section B",  # accounting rate of return
"0d199883-054f-415d-80b5-20a4c801d923": "Section B",  # maximize net benefits
"113ad9c8-c419-4621-9916-3a22ee066fce": "Section B",  # discounted payback
"187b0d38-9ed4-4f5a-b17e-8ba0b0ee26c8": "Section B",  # marginal product
"233d106f-9328-4bae-86d7-9102f979d1f1": "Section B",  # invest extra cash
"236b716e-aa1b-4f4d-adad-e6398ae900d7": "Section B",  # intl trade payment
"24cce348-a779-4631-893e-52a21f691a7f": "Section B",  # market shift strategy
"399a3444-3beb-4642-b643-7241ea9de0f3": "Section B",  # marginal cost of unit
"3a4ffe92-0380-4d91-9ed3-c74c103794d5": "Section B",  # new machine purchase
"3d540a9b-8160-4bb3-9c13-e6d458619816": "Section B",  # uncertainty about variables
"4acabcfa-6ca0-4012-8590-0c15bfd8bf8e": "Section B",  # spin-off
"58952446-3702-4b5d-b7f7-60ac51432f24": "Section B",  # check float
"5b4b9acc-8178-43a4-a12e-b8f8d4d9f27c": "Section B",  # profitability index
"5fac36c9-ea06-4792-8065-8d7adbae810b": "Section B",  # price elasticity
"5fd70b92-7f5c-4fbc-8b32-4811a647ee0f": "Section B",  # payback period
"61d3b23a-162e-42b4-b71f-053d4a7f5599": "Section B",  # vertical integration
"657d48d8-95f3-4226-982c-515191ef17df": "Section B",  # project after-tax cash inflow
"6780f4dc-eb41-45c4-8eaa-624be9d27279": "Section B",  # days' sales outstanding
"699fe4f7-35d1-4a19-8c88-a0e9835ea3f3": "Section B",  # trade credit decision
"6facba8e-33b6-468c-b568-a2f759c3a529": "Section B",  # capital rationing
"713414c7-c1b4-4f1e-ba20-c039ff089ca2": "Section B",  # FHA securities
"71f2dfc3-1ba4-4c19-95ef-f488d351859d": "Section B",  # receivables cash cycle
"739a611e-bfc9-4a2f-a1ad-974b3d972f6a": "Section B",  # profitability index > 1
"7e917092-89aa-4ef6-94c1-8511e05d4dd2": "Section B",  # cost of trade credit
"81f1e92f-ef2d-4e64-b43b-1c2201031871": "Section B",  # merger
"871d8ca7-e566-4666-a8a0-e2fde3bc4d22": "Section B",  # maturity matching
"88f1526f-6d94-4702-b4f7-955d1bd3a176": "Section B",  # Keynes cash motives
"9e1a5d5d-aed2-4550-9be2-ef8384f2d69e": "Section B",  # discounted note loan
"a1dcda5c-cd7c-4a76-8b86-7f5c2aa406de": "Section B",  # credit and collection
"a3136c63-51b9-457a-8941-70409c6d3bed": "Section B",  # new product strategy
"a7cb83ba-2a1c-4db8-bd16-cdaea1a1dc27": "Section B",  # project risk-adjusted rate
"aa301be7-3098-42ae-83cd-c0c1bfcdf9fd": "Section B",  # short vs long-term financing
"aae8e637-8b63-4ed2-8475-7138742a20fb": "Section B",  # capital rationing Maloney
"ad3af607-db5b-4314-9909-281a06f0e6bd": "Section B",  # project net cash benefit
"c2e45f22-e768-46fc-bab5-1c0cb383caa3": "Section B",  # price increase elasticity
"d2d5fe28-151c-454d-a8dd-fa14a659514b": "Section B",  # risk attitudes
"e9a35b67-59fd-45e9-b86b-751bd913a09e": "Section B",  # EOQ formula
"eb4345f4-6ee6-4b63-a797-312ba2a09cf6": "Section B",  # accelerate cash inflow
"f71cba25-4679-471a-8b44-3a609fb4edb7": "Section B",  # project net cash inflow
"f9695e67-3066-4671-a112-bff7ff2b1c7f": "Section B",  # profitability index
# --- Section C: performance / CVP ---
"3a887417-22f7-4948-b6b9-88d2a9d745e4": "Section C",  # ski model breakeven mix
"52a54a42-21bc-4dc3-817d-0c96c75c28fd": "Section C",  # unit sales CVP
"88e640a0-8588-4882-8141-496bc8f208e9": "Section C",  # advertising max spend CVP
"ed4266a9-07e5-494a-ad3a-0f9a1335e586": "Section C",  # before-tax profit CVP
"fe81f121-11e5-4bc7-9762-ec3599d4136a": "Section C",  # 10%-of-sales profit CVP
"d57c13c1-4c32-4917-ac04-79adc3953f3a": "Section C",  # cost of new capital
# --- Section D: cost management / relevant costs ---
"0f23ca65-e86f-4378-813a-68db42baa041": "Section D",  # cost of alternative
"1cbc0191-2e6b-4e95-954e-13cd16af8d6b": "Section D",  # special one-time order
"1e679180-2339-47eb-a905-7df2fc039a3e": "Section D",  # constrained multiproduct plant
"27b2242b-efde-447a-a361-e11bf578802f": "Section D",  # cost allocation scenario
"44d0bc93-6b81-4fb7-9bcc-81636707b592": "Section D",  # mall rent decision
"4e5e521b-80dc-4a0b-98a0-10f93591d08b": "Section D",  # reduce direct materials
"4fcd3b13-c4ca-44eb-b367-205f6ef39e44": "Section D",  # advertising allocation
"5d85cd2e-2b6d-4069-89df-26a144966e44": "Section D",  # opportunity cost definition
"73cecf13-e8dd-4068-af01-6cc87b0a6bcf": "Section D",  # cost of alternative
"7536793c-8dff-454e-949b-140bde28060f": "Section D",  # indirect labor cost behavior
"77e3ee99-68b8-4195-a5a5-fb46923f8619": "Section D",  # old machine trade-in
"7fcbac34-01b0-48aa-b591-2247187d1658": "Section D",  # delivery order decision
"860e69ce-38cc-46c4-9da8-4040b182c826": "Section D",  # relevant-cost pitfalls
"8fd85643-115e-441b-8d58-02dbe0a19620": "Section D",  # make-or-buy with rent
"927f22cf-494f-4839-848b-ff7888150315": "Section D",  # max transfer payment
"93e96e8d-347a-4a35-959f-ed666509cfb7": "Section D",  # idle capacity rent
"b87d8d2b-ce6f-4ec9-b4db-c4b0c7e7f901": "Section D",  # opportunity cost of input
"beac2ad6-a030-4f8f-a08d-9d8c23a507e5": "Section D",  # incremental profit order
"c3d54ce1-cbf1-4d16-8aa8-ba43e1db3ca9": "Section D",  # mall space decision
"c98d8b25-16b1-4d69-8881-63d6b1c95dd0": "Section D",  # advertising allocation
"cf770d97-ffc1-43b2-a230-7561340b01ef": "Section D",  # make-or-buy capacity
"d495b23c-0964-4cbc-b2ad-3fb154f2f67c": "Section D",  # cost of alternative
"e5d6a795-c876-4276-9860-1f59fab915fe": "Section D",  # mall revenue crossover
"ef75aa84-1f92-4076-b041-f51aac3516fe": "Section D",  # trade-in allowance
"f852047c-dcc5-4a01-bc5d-9406112c34c5": "Section D",  # make-or-buy savings
"f88f793d-50dd-4f68-80ea-683200f63707": "Section D",  # total cost of units
# --- Section E: ethics / controls / ERM ---
"12765572-a52c-4f99-b3bb-2cea6a82cf97": "Section E",  # virtue ethics
"1b98d92f-f24b-4083-b136-e97bef6ac7e0": "Section E",  # relativism
"4323919e-52dc-4523-8005-1872f7701b46": "Section E",  # morality vs virtue
"5009115d-e723-4dbf-bd03-663ff77d6b01": "Section E",  # teleology/utilitarianism
"5521e7f6-0ea8-4ed3-bfaa-e4ce1b3fa432": "Section E",  # PCAOB/SEC
"6434593b-a995-4096-80a2-c502f7616772": "Section E",  # found $20 ethics
"6692d355-2447-4730-afac-e91ed8716123": "Section E",  # ERM risk quantification
"7787b226-cf47-4625-ba14-62a8ebadae3c": "Section E",  # IMA confidentiality
"7da22b7a-ff40-4ff4-92a9-62d2e5ebed1f": "Section E",  # strategic risk types
"a5f7a361-633f-48f2-8ef6-707edd79f92f": "Section E",  # environmental ethics
"ac5b59a1-5063-4d8c-8fa7-9b4897312f66": "Section E",  # distributive justice
}

if __name__ == "__main__":
    assert len(ASSIGN) == 127, f"expected 127, got {len(ASSIGN)}"
    ids = list(ASSIGN)
    whens = "\n".join(f"  when id = '{i}' then '{ASSIGN[i]}'" for i in ids)
    in_list = ",\n".join(f"  '{i}'" for i in ids)
    sql = (
        "update public.question_bank set section = case\n" + whens +
        "\nend, updated_at = now()\nwhere id in (\n" + in_list + "\n);"
    )
    with open("phase3_handfix.sql", "w", encoding="utf-8") as f:
        f.write(sql)
    from collections import Counter
    print(Counter(ASSIGN.values()))
    print("rows:", len(ASSIGN), "| sql chars:", len(sql))
