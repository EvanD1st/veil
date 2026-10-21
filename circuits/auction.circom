pragma circom 2.2.2;
include "poseidon.circom";
include "comparators.circom";
include "bitify.circom";

// Public arrays are the complete accepted log in increasing acceptance order.
// Amounts and salts remain private. A strict greater-than update preserves the
// earliest accepted bid on ties. The server independently fixes all public inputs.
template HighestBid(N) {
    signal input context;
    signal input reserve;
    signal input count;
    signal input winnerIndex;
    signal input winningAmount;
    signal input bidIds[N];
    signal input commitments[N];
    signal input amounts[N];
    signal input salts[N];
    component countBits = Num2Bits(6); countBits.in <== count;
    component countLimit = LessEqThan(6); countLimit.in[0] <== count; countLimit.in[1] <== N; countLimit.out === 1;
    component reserveBits = Num2Bits(47); reserveBits.in <== reserve;
    component reserveLimit = LessEqThan(47); reserveLimit.in[0] <== reserve; reserveLimit.in[1] <== 100000000000000; reserveLimit.out === 1;
    component reserveZero = IsZero(); reserveZero.in <== reserve; reserveZero.out === 0;
    component active[N]; component amountBits[N];
    component amountLimit[N]; component amountZero[N]; component hash[N]; component eligible[N]; component larger[N];
    signal candidate[N]; signal update[N]; signal best[N+1]; signal bestIndex[N+1];
    best[0] <== 0; bestIndex[0] <== 0;
    for(var i=0; i<N; i++) {
        active[i] = LessThan(6); active[i].in[0] <== i; active[i].in[1] <== count;
        amountBits[i] = Num2Bits(47); amountBits[i].in <== amounts[i];
        amountLimit[i] = LessEqThan(47); amountLimit[i].in[0] <== amounts[i]; amountLimit[i].in[1] <== 100000000000000; amountLimit[i].out === 1;
        amountZero[i] = IsZero(); amountZero[i].in <== amounts[i]; active[i].out * amountZero[i].out === 0;
        (1-active[i].out)*amounts[i] === 0; (1-active[i].out)*salts[i] === 0;
        (1-active[i].out)*bidIds[i] === 0; (1-active[i].out)*commitments[i] === 0;
        hash[i] = Poseidon(4); hash[i].inputs[0] <== context; hash[i].inputs[1] <== bidIds[i]; hash[i].inputs[2] <== amounts[i]; hash[i].inputs[3] <== salts[i];
        active[i].out * (hash[i].out - commitments[i]) === 0;
        eligible[i] = LessThan(47); eligible[i].in[0] <== amounts[i]; eligible[i].in[1] <== reserve;
        larger[i] = LessThan(47); larger[i].in[0] <== best[i]; larger[i].in[1] <== amounts[i];
        candidate[i] <== active[i].out * (1-eligible[i].out);
        update[i] <== candidate[i] * larger[i].out;
        best[i+1] <== best[i] + update[i]*(amounts[i]-best[i]);
        bestIndex[i+1] <== bestIndex[i] + update[i]*(i+1-bestIndex[i]);
    }
    winnerIndex === bestIndex[N]; winningAmount === best[N];
}
component main {public [context,reserve,count,winnerIndex,winningAmount,bidIds,commitments]} = HighestBid(8);
