import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';

const PACKAGE_ID = '0x588c00f96eff4b853c832605083ff60386d6f95f83af05ad48d6875896d49dcb';

export interface MemberDebt {
  creditor: string;
  amount: number;
}

export interface MemberCredit {
  debtor: string;
  amount: number;
}

export interface NetBalance {
  net_amount: number;
  debt_amount: number;
  is_positive: boolean;
}

export interface GroupDebtSummary {
  total_expenses: number;
  total_debt: number;
  active_debts: number;
}

export class SuiService {
  private client: SuiClient;

  constructor() {
    this.client = new SuiClient({ url: getFullnodeUrl('testnet') });
  }

  /**
   * Get all debts for a member (who they owe money to)
   */
  async getMemberDebts(groupId: string, memberAddress: string): Promise<MemberDebt[]> {
    try {
      const txb = new TransactionBlock();
      
      // Call the smart contract view function
      txb.moveCall({
        target: `${PACKAGE_ID}::payment_splitter::get_member_debts`,
        arguments: [
          txb.object(groupId),
          txb.pure(memberAddress, 'address')
        ],
      });

      const result = await this.client.devInspectTransactionBlock({
        transactionBlock: txb,
        sender: memberAddress,
      });

      if (result.results?.[0]?.returnValues) {
        const returnValues = result.results[0].returnValues;
        
        // Parse the returned vectors (creditors and amounts)
        const creditorsData = returnValues[0]?.[0];
        const amountsData = returnValues[1]?.[0];
        
        if (creditorsData && amountsData) {
          // Parse the BCS encoded data
          const creditors = this.parseBcsVector(creditorsData, 'address');
          const amounts = this.parseBcsVector(amountsData, 'u64');
          
          return creditors.map((creditor: string, index: number) => ({
            creditor,
            amount: amounts[index] / 1000000000 // Convert from MIST to SUI
          }));
        }
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching member debts:', error);
      return [];
    }
  }

  /**
   * Get all credits for a member (who owes them money)
   */
  async getMemberCredits(groupId: string, memberAddress: string): Promise<MemberCredit[]> {
    try {
      const txb = new TransactionBlock();
      
      txb.moveCall({
        target: `${PACKAGE_ID}::payment_splitter::get_member_credits`,
        arguments: [
          txb.object(groupId),
          txb.pure(memberAddress, 'address')
        ],
      });

      const result = await this.client.devInspectTransactionBlock({
        transactionBlock: txb,
        sender: memberAddress,
      });

      if (result.results?.[0]?.returnValues) {
        const returnValues = result.results[0].returnValues;
        
        const debtorsData = returnValues[0]?.[0];
        const amountsData = returnValues[1]?.[0];
        
        if (debtorsData && amountsData) {
          const debtors = this.parseBcsVector(debtorsData, 'address');
          const amounts = this.parseBcsVector(amountsData, 'u64');
          
          return debtors.map((debtor: string, index: number) => ({
            debtor,
            amount: amounts[index] / 1000000000 // Convert from MIST to SUI
          }));
        }
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching member credits:', error);
      return [];
    }
  }

  /**
   * Get net balance for a member
   */
  async getNetBalance(groupId: string, memberAddress: string): Promise<NetBalance> {
    try {
      const txb = new TransactionBlock();
      
      txb.moveCall({
        target: `${PACKAGE_ID}::payment_splitter::get_net_balance`,
        arguments: [
          txb.object(groupId),
          txb.pure(memberAddress, 'address')
        ],
      });

      const result = await this.client.devInspectTransactionBlock({
        transactionBlock: txb,
        sender: memberAddress,
      });

      if (result.results?.[0]?.returnValues) {
        const returnValues = result.results[0].returnValues;
        
        const netAmount = this.parseBcsU64(returnValues[0]?.[0]) / 1000000000;
        const debtAmount = this.parseBcsU64(returnValues[1]?.[0]) / 1000000000;
        const isPositive = this.parseBcsBool(returnValues[2]?.[0]);
        
        return {
          net_amount: netAmount,
          debt_amount: debtAmount,
          is_positive: isPositive
        };
      }
      
      return { net_amount: 0, debt_amount: 0, is_positive: true };
    } catch (error) {
      console.error('Error fetching net balance:', error);
      return { net_amount: 0, debt_amount: 0, is_positive: true };
    }
  }

  /**
   * Get debt amount between two specific members
   */
  async getDebtAmount(groupId: string, debtor: string, creditor: string): Promise<number> {
    try {
      const txb = new TransactionBlock();
      
      txb.moveCall({
        target: `${PACKAGE_ID}::payment_splitter::get_debt_amount`,
        arguments: [
          txb.object(groupId),
          txb.pure(debtor, 'address'),
          txb.pure(creditor, 'address')
        ],
      });

      const result = await this.client.devInspectTransactionBlock({
        transactionBlock: txb,
        sender: debtor,
      });

      if (result.results?.[0]?.returnValues?.[0]?.[0]) {
        const amount = this.parseBcsU64(result.results[0].returnValues[0][0]);
        return amount / 1000000000; // Convert from MIST to SUI
      }
      
      return 0;
    } catch (error) {
      console.error('Error fetching debt amount:', error);
      return 0;
    }
  }

  /**
   * Get settlement summary for the entire group
   */
  async getSettlementSummary(groupId: string, callerAddress: string): Promise<GroupDebtSummary> {
    try {
      const txb = new TransactionBlock();
      
      txb.moveCall({
        target: `${PACKAGE_ID}::payment_splitter::get_settlement_summary`,
        arguments: [txb.object(groupId)],
      });

      const result = await this.client.devInspectTransactionBlock({
        transactionBlock: txb,
        sender: callerAddress,
      });

      if (result.results?.[0]?.returnValues) {
        const returnValues = result.results[0].returnValues;
        
        const totalExpenses = this.parseBcsU64(returnValues[0]?.[0]) / 1000000000;
        const totalDebt = this.parseBcsU64(returnValues[1]?.[0]) / 1000000000;
        const activeDebts = this.parseBcsU64(returnValues[2]?.[0]);
        
        return {
          total_expenses: totalExpenses,
          total_debt: totalDebt,
          active_debts: activeDebts
        };
      }
      
      return { total_expenses: 0, total_debt: 0, active_debts: 0 };
    } catch (error) {
      console.error('Error fetching settlement summary:', error);
      return { total_expenses: 0, total_debt: 0, active_debts: 0 };
    }
  }

  /**
   * Get detailed debt information for all group members
   */
  async getGroupMembersWithBalances(groupId: string, memberAddresses: string[], callerAddress: string): Promise<Array<{address: string, netBalance: NetBalance, debts: MemberDebt[], credits: MemberCredit[]}>> {
    try {
      const results = await Promise.all(
        memberAddresses.map(async (address) => {
          const [netBalance, debts, credits] = await Promise.all([
            this.getNetBalance(groupId, address),
            this.getMemberDebts(groupId, address),
            this.getMemberCredits(groupId, address)
          ]);
          
          return {
            address,
            netBalance,
            debts,
            credits
          };
        })
      );
      
      return results;
    } catch (error) {
      console.error('Error fetching group members with balances:', error);
      return [];
    }
  }

  /**
   * Settle a debt between the current user and a creditor
   */
  async settleDebt(
    groupId: string,
    creditorAddress: string,
    amountInSui: number,
    signerAddress: string,
    signAndExecuteTransactionBlock: Function
  ): Promise<{ success: boolean; transactionDigest?: string; error?: string }> {
    try {
      const txb = new TransactionBlock();
      
      // Convert SUI to MIST (multiply by 10^9)
      const amountInMist = Math.floor(amountInSui * 1000000000);
      
      // Create a coin object with the payment amount
      const [coin] = txb.splitCoins(txb.gas, [txb.pure(amountInMist)]);
      
      // Call the settle_debt function
      txb.moveCall({
        target: `${PACKAGE_ID}::payment_splitter::settle_debt`,
        arguments: [
          txb.object(groupId),
          txb.pure(creditorAddress, 'address'),
          coin
        ],
      });

      // Execute the transaction using the wallet's signing function
      const result = await signAndExecuteTransactionBlock({
        transactionBlock: txb,
        options: { showEffects: true },
      });
      
      return {
        success: true,
        transactionDigest: result.digest
      };
    } catch (error) {
      console.error('Error settling debt:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to settle debt'
      };
    }
  }

  /**
   * Simplify debts in the group to reduce the number of transactions needed
   */
  async simplifyDebts(groupId: string, signAndExecuteTransactionBlock: Function): Promise<{ success: boolean; transactionDigest?: string; error?: string }> {
    try {
      const txb = new TransactionBlock();
      
      txb.moveCall({
        target: `${PACKAGE_ID}::payment_splitter::simplify_debts`,
        arguments: [
          txb.object(groupId)
        ],
      });

      // Execute the transaction using the wallet's signing function
      const result = await signAndExecuteTransactionBlock({
        transactionBlock: txb,
        options: { showEffects: true },
      });
      
      return {
        success: true,
        transactionDigest: result.digest
      };
    } catch (error) {
      console.error('Error simplifying debts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to simplify debts'
      };
    }
  }

  /**
   * Create an expense on the smart contract (real transaction)
   */
  async createExpense(
    groupId: string,
    description: string,
    amountInSui: number,
    participants: string[],
    signAndExecuteTransactionBlock: Function // Signature function directly
  ): Promise<{ success: boolean; transactionDigest?: string; error?: string }> {
    try {
      const txb = new TransactionBlock();
      const amountInMist = Math.floor(amountInSui * 1_000_000_000);
      const [coin] = txb.splitCoins(txb.gas, [txb.pure(amountInMist)]);
      const descriptionBytes = Array.from(new TextEncoder().encode(description));
      txb.moveCall({
        target: `${PACKAGE_ID}::payment_splitter::create_expense`,
        arguments: [
          txb.object(groupId),
          txb.pure(descriptionBytes),
          coin,
          txb.pure(participants)
        ],
      });
      // Directly call the provided sign and execute function
      const result = await signAndExecuteTransactionBlock({
        transactionBlock: txb,
        options: { showEffects: true },
      });
      return {
        success: true,
        transactionDigest: result.digest,
      };
    } catch (error) {
      console.error('Error creating expense:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create expense'
      };
    }
  }

  // Helper methods for parsing BCS encoded data
  private parseBcsU64(data: number[]): number {
    if (!data || data.length !== 8) return 0;
    
    let result = 0;
    for (let i = 0; i < 8; i++) {
      result += data[i] * Math.pow(256, i);
    }
    return result;
  }

  private parseBcsBool(data: number[]): boolean {
    return data && data.length > 0 ? data[0] !== 0 : false;
  }

  private parseBcsVector(data: number[], type: 'address' | 'u64'): any[] {
    if (!data || data.length === 0) return [];
    
    try {
      // This is a simplified parser - in production you'd want to use proper BCS parsing
      const result = [];
      let offset = 0;
      
      // Read vector length (first 4 bytes as little-endian u32)
      const length = data[0] + (data[1] << 8) + (data[2] << 16) + (data[3] << 24);
      offset = 4;
      
      for (let i = 0; i < length; i++) {
        if (type === 'address') {
          // Addresses are 32 bytes (actually 20 bytes for Ethereum-style, but Sui uses 32)
          const addressBytes = data.slice(offset, offset + 32);
          const address = '0x' + addressBytes.map(b => b.toString(16).padStart(2, '0')).join('');
          result.push(address);
          offset += 32;
        } else if (type === 'u64') {
          // u64 is 8 bytes
          const value = this.parseBcsU64(data.slice(offset, offset + 8));
          result.push(value);
          offset += 8;
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error parsing BCS vector:', error);
      return [];
    }
  }
}

export default new SuiService();
