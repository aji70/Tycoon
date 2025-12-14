
import { describe, expect, it } from "vitest";
import { Cl, someCV, tupleCV, ClarityValue, UIntCV, TupleCV, ClarityType} from "@stacks/transactions";


const accounts = simnet.getAccounts();
const alice = accounts.get("wallet_1")!;
const bob = accounts.get("wallet_2")!;
const charlie = accounts.get("wallet_3")!;
const dave = accounts.get("wallet_4")!;



/*
  The test below is an example. To learn more, read the testing documentation here:
  https://docs.hiro.so/stacks/clarinet-js-sdk
*/



describe("tyc Contract Tests", () => {
  it("ensures simnet is well initialised", () => {
    expect(simnet.blockHeight).toBeDefined();
  });

  it("shows an example", () => {
    const { result } = simnet.callReadOnlyFn("tyc", "is-registered",[Cl.principal(alice)], alice);
    expect(result).toEqual(Cl.bool(false));
  });

    it("allows a user to register with a unique username", () => {
    const { result: registerResult } = simnet.callPublicFn(
      "tyc",
      "register",
      [Cl.stringAscii("AliceUser")],
      alice
    );

    expect(registerResult).toBeOk(Cl.bool(true));

    const { result: isRegisteredResult } = simnet.callReadOnlyFn(
      "tyc",
      "is-registered",
      [Cl.principal(alice)],
      alice
    );

    expect(isRegisteredResult).toEqual(Cl.bool(true));
  });

    it("prevents duplicate registration", () => {
    simnet.callPublicFn("tyc", "register", [Cl.stringAscii("AliceUser")], alice);

    const { result: secondAttempt } = simnet.callPublicFn(
      "tyc",
      "register",
      [Cl.stringAscii("AliceUser")],
      alice
    );

    expect(secondAttempt).toBeErr(Cl.uint(100)); // ERR_ALREADY_REGISTERED
  });

   it("rejects taken usernames", () => {
    simnet.callPublicFn("tyc", "register", [Cl.stringAscii("AliceUser")], alice);

    const { result: takenUsername } = simnet.callPublicFn(
      "tyc",
      "register",
      [Cl.stringAscii("AliceUser")],
      bob
    );

    expect(takenUsername).toBeErr(Cl.uint(101)); // ERR_USERNAME_TAKEN
  });



  it("allows a registered user to create a game and updates user stats", async () => {
    // Register the user
    await simnet.callPublicFn("tyc", "register", [Cl.stringAscii("AliceUser")], alice);

    // Create a new game
    const { result: createResult } = await simnet.callPublicFn(
      "tyc",
      "create-game",
      [
        Cl.uint(1),            // game-type
        Cl.uint(1),            // player-symbol
        Cl.uint(2),            // number-of-players
        Cl.stringAscii("GAME123"),
        Cl.uint(1000),         // starting balance
        Cl.uint(500)           // bet amount
      ],
      alice
    );

    // First game ID should be 0
    expect(createResult).toBeOk(Cl.uint(0));

    // Check contract owner (optional, just logging here)
    const { result: ownerResult } = await simnet.callReadOnlyFn("tyc", "get-owner", [], alice);
    console.log("Owner result:", ownerResult);

    // Check user stats updated
    const { result: userResult } = await simnet.callReadOnlyFn(
      "tyc",
      "get-user",
      [Cl.principal(alice)],
      alice
    );

    // Ensure optional-some
    if (userResult.type !== ClarityType.OptionalSome) {
      throw new Error("User not found");
    }

    // Extract tuple
    const userTuple = userResult.value as TupleCV;

    // Access fields safely
    const data = userTuple.value;
    const gamesPlayed = (data["games-played"] as UIntCV).value;
    const totalStaked = (data["total-staked"] as UIntCV).value;   

    // Assertions
    expect(gamesPlayed).toBe(BigInt(1));
    expect(totalStaked).toBe(BigInt(500));
    
  });

  it("allows another registered user to join a game and updates user stats", async () => {
  // Register both players
  await simnet.callPublicFn("tyc", "register", [Cl.stringAscii("AliceUser")], alice);
  await simnet.callPublicFn("tyc", "register", [Cl.stringAscii("BobUser")], bob);

  // Create game by Alice
  const { result: gameResult } = await simnet.callPublicFn(
    "tyc",
    "create-game",
    [
      Cl.uint(1),
      Cl.uint(1),
      Cl.uint(2),
      Cl.stringAscii("GAME123"),
      Cl.uint(1000),
      Cl.uint(500)
    ],
    alice
  );
  expect(gameResult).toBeOk(Cl.uint(0));

  // Check Alice stats before join
  const { result: aliceUserBefore } = await simnet.callReadOnlyFn(
    "tyc",
    "get-user",
    [Cl.principal(alice)],
    alice
  );
  if (aliceUserBefore.type !== ClarityType.OptionalSome) throw new Error("Alice user not found");
  const aliceData = (aliceUserBefore.value as TupleCV).value;
  expect((aliceData["games-played"] as UIntCV).value).toBe(BigInt(1));
  expect((aliceData["total-staked"] as UIntCV).value).toBe(BigInt(500));

  // Bob joins game 0
  const { result: joinResult } = await simnet.callPublicFn(
    "tyc",
    "join-game",
    [Cl.uint(0), Cl.uint(2)],
    bob
  );
  expect(joinResult).toBeOk(Cl.uint(2));

  // Check Bob stats updated
  const { result: bobUserAfter } = await simnet.callReadOnlyFn(
    "tyc",
    "get-user",
    [Cl.principal(bob)],
    bob
  );
  if (bobUserAfter.type !== ClarityType.OptionalSome) throw new Error("Bob user not found");
  const bobData = (bobUserAfter.value as TupleCV).value;
  expect((bobData["games-played"] as UIntCV).value).toBe(BigInt(1));
  expect((bobData["total-staked"] as UIntCV).value).toBe(BigInt(500));

  // Game should now be ongoing
  const { result: gameAfter } = await simnet.callReadOnlyFn(
    "tyc",
    "get-game",
    [Cl.uint(0)],
    alice
  );
  if (gameAfter.type !== ClarityType.OptionalSome) throw new Error("Game not found");
  const gameData = (gameAfter.value as TupleCV).value;
  expect((gameData["status"] as UIntCV).value).toBe(BigInt(2));
});

it("allows a player to update position and balance during ongoing game", async () => {
  // Register and setup 2-player game
  await simnet.callPublicFn("tyc", "register", [Cl.stringAscii("AliceUser")], alice);
  await simnet.callPublicFn("tyc", "register", [Cl.stringAscii("BobUser")], bob);

  await simnet.callPublicFn(
    "tyc",
    "create-game",
    [
      Cl.uint(1),
      Cl.uint(1),
      Cl.uint(2),
      Cl.stringAscii("GAMEPOS"),
      Cl.uint(1000),
      Cl.uint(500)
    ],
    alice
  );

  await simnet.callPublicFn("tyc", "join-game", [Cl.uint(0), Cl.uint(2)], bob);

  // Alice updates position (only caller can update own)
  const { result: updateResult } = await simnet.callPublicFn(
    "tyc",
    "update-player-position",
    [
      Cl.uint(0),        // game-id
      Cl.principal(alice), // player (self)
      Cl.uint(10),       // new-position
      Cl.uint(900),      // new-balance
      Cl.none()          // no property
    ],
    alice
  );
  expect(updateResult).toBeOk(Cl.bool(true));

  // Verify update
  const { result: playerResult } = await simnet.callReadOnlyFn(
    "tyc",
    "get-game-player",
    [Cl.uint(0), Cl.principal(alice)],
    alice
  );
  if (playerResult.type !== ClarityType.OptionalSome) throw new Error("Player not found");
  const playerData = (playerResult.value as TupleCV).value;
  expect((playerData["position"] as UIntCV).value).toBe(BigInt(10));
  expect((playerData["balance"] as UIntCV).value).toBe(BigInt(900));
});

it("allows updating position with property ownership", async () => {
  // Setup as above
  await simnet.callPublicFn("tyc", "register", [Cl.stringAscii("AliceUser")], alice);
  await simnet.callPublicFn("tyc", "register", [Cl.stringAscii("BobUser")], bob);

  await simnet.callPublicFn(
    "tyc",
    "create-game",
    [
      Cl.uint(1),
      Cl.uint(1),
      Cl.uint(2),
      Cl.stringAscii("GAMEPROP"),
      Cl.uint(1000),
      Cl.uint(500)
    ],
    alice
  );

  await simnet.callPublicFn("tyc", "join-game", [Cl.uint(0), Cl.uint(2)], bob);

  // Alice updates and claims property 5
  const { result: updateResult } = await simnet.callPublicFn(
    "tyc",
    "update-player-position",
    [
      Cl.uint(0),
      Cl.principal(alice),
      Cl.uint(5),
      Cl.uint(800),
      Cl.some(Cl.uint(5)) // property-id
    ],
    alice
  );
  expect(updateResult).toBeOk(Cl.bool(true));

  // Verify property ownership
  const { result: propResult } = await simnet.callReadOnlyFn(
    "tyc",
    "get-property",
    [Cl.uint(0), Cl.uint(5)],
    alice
  );
  if (propResult.type !== ClarityType.OptionalSome) throw new Error("Property not found");
  const propData = (propResult.value as TupleCV).value;
  expect((propData["owner"] as any).value).toEqual(alice);
  expect((propData["base-price"] as UIntCV).value).toBe(BigInt(100));
  expect((propData["current-rent"] as UIntCV).value).toBe(BigInt(10));
});

it("prevents non-player from updating position", async () => {
  await simnet.callPublicFn("tyc", "register", [Cl.stringAscii("AliceUser")], alice);
  await simnet.callPublicFn("tyc", "register", [Cl.stringAscii("BobUser")], bob);

  await simnet.callPublicFn(
    "tyc",
    "create-game",
    [
      Cl.uint(1),
      Cl.uint(1),
      Cl.uint(2),
      Cl.stringAscii("GAMEAUTH"),
      Cl.uint(1000),
      Cl.uint(500)
    ],
    alice
  );

  await simnet.callPublicFn("tyc", "join-game", [Cl.uint(0), Cl.uint(2)], bob);

  // Bob tries to update Alice's position
  const { result: unauthorizedUpdate } = await simnet.callPublicFn(
    "tyc",
    "update-player-position",
    [
      Cl.uint(0),
      Cl.principal(alice), // Alice's position
      Cl.uint(10),
      Cl.uint(900),
      Cl.none()
    ],
    bob // Called by Bob
  );

  expect(unauthorizedUpdate).toBeErr(Cl.uint(208)); // ERR_NOT_PLAYER
});

// it("allows finalizing a game and winner to withdraw payout", async () => {
//   // Setup 2-player game
//   await simnet.callPublicFn("tyc", "register", [Cl.stringAscii("AliceUser")], alice);
//   await simnet.callPublicFn("tyc", "register", [Cl.stringAscii("BobUser")], bob);

//   await simnet.callPublicFn(
//     "tyc",
//     "create-game",
//     [
//       Cl.uint(1),
//       Cl.uint(1),
//       Cl.uint(2),
//       Cl.stringAscii("GAMEWIN"),
//       Cl.uint(1000),
//       Cl.uint(500)
//     ],
//     alice
//   );

//   await simnet.callPublicFn("tyc", "join-game", [Cl.uint(0), Cl.uint(2)], bob);

//   // Finalize game with Alice as winner
//   const { result: finalizeResult } = await simnet.callPublicFn(
//     "tyc",
//     "finalize-game",
//     [Cl.uint(0), Cl.principal(alice), Cl.uint(15)],
//     alice
//   );
//   expect(finalizeResult).toBeOk(Cl.uint(1000));

//   // Winner withdraws payout
//   const { result: payoutResult } = await simnet.callPublicFn(
//     "tyc",
//     "withdraw-payout",
//     [Cl.uint(0)],
//     alice
//   );
//   // expect(payoutResult).toBeOk(Cl.uint(1000));
//   console.log("payouts ", payoutResult)

//   // Attempting to withdraw again fails
// //   const { result: doubleWithdraw } = await simnet.callPublicFn(
// //     "tyc",
// //     "withdraw-payout",
// //     [Cl.uint(0)],
// //     alice
// //   );
// //   expect(doubleWithdraw).toBeErr(Cl.uint(ERR_ALREADY_CLAIMED));
// // 
// });

// it("finalizes game without bonus if turns < MIN and allows payout", async () => {
//   await simnet.callPublicFn("tyc", "register", [Cl.stringAscii("CharlieUser")], charlie);
//   await simnet.callPublicFn("tyc", "register", [Cl.stringAscii("DaveUser")], dave);

//   await simnet.callPublicFn(
//     "tyc",
//     "create-game",
//     [
//       Cl.uint(1),
//       Cl.uint(1),
//       Cl.uint(2),
//       Cl.stringAscii("NOBONUS"),
//       Cl.uint(1000),
//       Cl.uint(500)
//     ],
//     charlie
//   );

//   await simnet.callPublicFn("tyc", "join-game", [Cl.uint(0), Cl.uint(2)], dave);

//   // Finalize with fewer turns
//   const { result: finalizeResult } = await simnet.callPublicFn(
//     "tyc",
//     "finalize-game",
//     [Cl.uint(0), Cl.principal(charlie), Cl.uint(5)],
//     charlie
//   );
//   expect(finalizeResult).toBeOk(Cl.uint(1000));

//   // Charlie withdraws payout
//   const { result: payoutResult } = await simnet.callPublicFn(
//     "tyc",
//     "withdraw-payout",
//     [Cl.uint(0)],
//     charlie
//   );
//   expect(payoutResult).toBeOk(Cl.uint(1000));
// });

// it("removes a player and ends game if one remains, then winner withdraws", async () => {
//   await simnet.callPublicFn("tyc", "register", [Cl.stringAscii("AliceUser")], alice);
//   await simnet.callPublicFn("tyc", "register", [Cl.stringAscii("BobUser")], bob);

//   const { result: createRes } = await simnet.callPublicFn(
//     "tyc",
//     "create-game",
//     [
//       Cl.uint(1),
//       Cl.uint(1),
//       Cl.uint(2),
//       Cl.stringAscii("GAMEEND"),
//       Cl.uint(1000),
//       Cl.uint(500)
//     ],
//     alice
//   );
//   expect(createRes).toBeOk(Cl.uint(0));

//   const { result: joinRes } = await simnet.callPublicFn("tyc", "join-game", [Cl.uint(0), Cl.uint(2)], bob);
//   expect(joinRes).toBeOk(Cl.uint(2));

//   // Remove Bob (Alice remains)
//   const { result: removeResult } = await simnet.callPublicFn(
//     "tyc",
//     "remove-player",
//     [Cl.uint(0), Cl.principal(bob), Cl.some(Cl.principal(alice)), Cl.uint(15)],
//     alice
//   );
//   expect(removeResult).toBeOk(Cl.bool(true));

//   // Check game ended
//   const { result: endedGame } = await simnet.callReadOnlyFn("tyc", "get-game", [Cl.uint(0)], alice);
//   if (endedGame.type !== ClarityType.OptionalSome) throw new Error("Game not found");
//   const endedTuple = (endedGame.value as TupleCV).value;
//   expect((endedTuple["status"] as UIntCV).value).toBe(BigInt(3));
//   expect((endedTuple["winner"] as any).value).toBe(alice);

//   // Winner withdraws payout
//   const { result: payoutResult } = await simnet.callPublicFn(
//     "tyc",
//     "withdraw-payout",
//     [Cl.uint(0)],
//     alice
//   );
//   expect(payoutResult).toBeOk(Cl.uint(1000));
// });



});


