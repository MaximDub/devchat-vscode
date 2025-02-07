import { expect } from 'chai';
import { describe, it } from 'mocha';
import mockFs from 'mock-fs';
import * as fs from 'fs';
import * as path from 'path';
import CustomCommands, { Command } from '../../src/command/customCommand';


describe('CustomCommands', () => {
  let customCommands: CustomCommands;

  beforeEach(() => {
    customCommands = CustomCommands.getInstance();
  });

  afterEach(() => {
    // Reset the command list after each test
    customCommands['commands'] = [];
	mockFs.restore();
  });

  it('should parse commands from workflows directory', () => {
    // Mock the file system with two directories, one with _setting_.json and one without
    mockFs({
      'workflows': {
		"some": {
			"command": {
				'command1': {
					'_setting_.json': JSON.stringify({
					  pattern: 'command1',
					  description: 'Command 1',
					  message: 'Command 1 message',
					  default: false,
					  show: true,
					  instructions: ['instruction1', 'instruction2'],
					}),
				},
				'command2': {
					// No _setting_.json file
				},
			}
		}
      }
    });

    const workflowsDir = path.join(process.cwd(), 'workflows');
    customCommands.parseCommands(workflowsDir);

    const expectedResult: Command[] = [
      {
        name: 'command1',
        pattern: 'command1',
        description: 'Command 1',
        message: 'Command 1 message',
        default: false,
		args: 0,
        show: true,
        instructions: ['instruction1', 'instruction2'],
      },
    ];

	expectedResult[0].instructions = [path.join(workflowsDir, 'some', 'command', 'command1', 'instruction1'), path.join(workflowsDir, 'some', 'command', 'command1', 'instruction2')];
    expect(customCommands['commands']).to.deep.equal(expectedResult);
  });

  it('should register a custom command', () => {
    const command: Command = {
      name: 'test',
      pattern: 'test',
      description: 'Test command',
      message: 'Test message',
      default: false,
	  args: 0,
      show: true,
      instructions: ['instruction1', 'instruction2'],
    };

    customCommands.regCommand(command);
    expect(customCommands['commands']).to.include(command);
  });

  it('should get a custom command by name', () => {
    const command: Command = {
      name: 'test',
      pattern: 'test',
      description: 'Test command',
      message: 'Test message',
      default: false,
	  args: 0,
      show: true,
      instructions: ['instruction1', 'instruction2'],
    };

    customCommands.regCommand(command);
    const foundCommand = customCommands.getCommand('test');
    expect(foundCommand).to.deep.equal(command);
  });

  it('should handle a custom command', () => {
    const command: Command = {
      name: 'test',
      pattern: 'test',
      description: 'Test command',
      message: 'Test message',
      default: false,
	  args: 0,
      show: true,
      instructions: ['instruction1', 'instruction2'],
    };

    customCommands.regCommand(command);
    const result = customCommands.handleCommand('test', '');
    expect(result).to.equal('[instruction|instruction1] [instruction|instruction2]  Test message');
  });

  it('should handle a custom command with args', () => {
    const command: Command = {
      name: 'test',
      pattern: 'test {{prompt}}',
      description: 'Test command',
      message: 'Test message "$1","$2"',
      default: false,
	  args: 0,
      show: true,
      instructions: ['instruction1', 'instruction2'],
    };

    customCommands.regCommand(command);
    const result = customCommands.handleCommand('test', '["v1", "v2"]');
    expect(result).to.equal('[instruction|instruction1] [instruction|instruction2]  Test message "v1","v2"');
  });
});